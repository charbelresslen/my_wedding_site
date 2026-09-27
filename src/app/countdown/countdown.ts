import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { revealOnView } from '../shared/reveal-on-view';

/**
 * The moment the celebration begins: 19 December 2026, 16:00 (the arrival at the ZAGS, as in the programme).
 * It is read as the guest's local time. To pin it to the venue's time zone whatever the guest's own is, add the
 * offset, e.g. '2026-12-19T16:00:00+03:00'.
 */
export const CELEBRATION = new Date('2026-12-19T16:00:00');

export interface Parts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/**
 * Days, hours, minutes and seconds in a span of milliseconds (never negative). A started second counts as a whole one,
 * so the clock shows 00:00:01 during the very last second and reaches 00:00:00 exactly when the celebration begins.
 */
export function splitRemaining(ms: number): Parts {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3_600),
    minutes: Math.floor((total % 3_600) / 60),
    seconds: total % 60,
  };
}

/** The Russian noun form that goes with a number: 1 день, 2 дня, 5 дней, 11 дней, 21 день. */
export function plural(n: number, forms: readonly [string, string, string]): string {
  const lastTwo = n % 100;
  const last = n % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return forms[2];
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}

const UNITS = [
  { key: 'days', forms: ['день', 'дня', 'дней'] },
  { key: 'hours', forms: ['час', 'часа', 'часов'] },
  { key: 'minutes', forms: ['минута', 'минуты', 'минут'] },
  { key: 'seconds', forms: ['секунда', 'секунды', 'секунд'] },
] as const;

interface Glyph {
  /** a new id makes a new element, which is what plays the "roll in" animation */
  id: number;
  char: string;
}

/** One digit. It holds one glyph at rest; while it changes it holds two: the old one (rolling out) then the new one. */
interface Cell {
  glyphs: Glyph[];
}

interface UnitView {
  key: string;
  label: string;
  cells: Cell[];
}

/**
 * Step 6: the countdown to the celebration. Days, hours, minutes and seconds; whenever a digit changes the old
 * one slides up and fades out while the new one slides up into its place (only transform and opacity, so it runs on
 * the compositor). The clock ticks only while the section is near the screen and the tab is visible.
 */
@Component({
  selector: 'app-countdown',
  templateUrl: './countdown.html',
  styleUrl: './countdown.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.is-visible]': 'visible()' },
})
export class Countdown {
  /** True once the section has scrolled into view (starts its entrance). */
  protected readonly visible = revealOnView(0.3);

  protected readonly units = signal<UnitView[]>([]);
  protected readonly finished = signal(false);
  private readonly parts = signal<Parts>({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  /** Read out by screen readers instead of the ticking digits; it only changes once a minute. */
  protected readonly spoken = computed(() => {
    if (this.finished()) return 'Торжество началось';
    const { days, hours, minutes } = this.parts();
    const [d, h, m] = UNITS;
    return `До начала торжества: ${days} ${plural(days, d.forms)}, ${hours} ${plural(hours, h.forms)}, ${minutes} ${plural(minutes, m.forms)}`;
  });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private nextId = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private nearScreen = true;

  constructor() {
    this.tick();
    afterNextRender(() => {
      this.watchScreen();
      this.sync();
    });
    this.destroyRef.onDestroy(() => this.stop());
  }

  /** Works out the time left and rolls whichever digits changed. */
  private tick(): void {
    const remaining = CELEBRATION.getTime() - Date.now();
    const parts = splitRemaining(remaining);
    this.parts.set(parts);
    this.finished.set(remaining <= 0);

    const before = this.units();
    this.units.set(
      UNITS.map((unit, index) => {
        const value = parts[unit.key];
        const text = String(value).padStart(2, '0');
        const old = before[index];
        // when the number of digits changes (100 days -> 99) the digits are simply drawn again, no roll
        const sameShape = old?.cells.length === text.length;
        const cells = [...text].map((char, i): Cell => {
          const previous = sameShape ? old.cells[i] : undefined;
          if (!previous) return { glyphs: [{ id: this.nextId++, char }] };
          const current = previous.glyphs[previous.glyphs.length - 1];
          if (current.char === char) return previous;
          return { glyphs: [current, { id: this.nextId++, char }] };
        });
        return { key: unit.key, label: plural(value, unit.forms), cells };
      }),
    );
  }

  /** Ticks on the second, straight from the clock (so it never drifts), until the celebration has begun. */
  private schedule(): void {
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.tick();
      if (!this.finished()) this.schedule();
    }, 1000 - (Date.now() % 1000) + 5);
  }

  /** Runs while the section is near the screen and the tab is in front; catches up at once when it resumes. */
  private sync(): void {
    const shouldRun = this.nearScreen && !document.hidden && !this.finished();
    if (shouldRun && this.timer === undefined) {
      this.tick();
      if (!this.finished()) this.schedule();
    } else if (!shouldRun) {
      this.stop();
    }
  }

  private stop(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  private watchScreen(): void {
    const onVisibility = () => this.sync();
    document.addEventListener('visibilitychange', onVisibility);
    this.destroyRef.onDestroy(() => document.removeEventListener('visibilitychange', onVisibility));

    if (typeof IntersectionObserver !== 'function') return;
    const observer = new IntersectionObserver(
      (entries) => {
        this.nearScreen = entries.some((entry) => entry.isIntersecting);
        this.sync();
      },
      { rootMargin: '300px 0px' },
    );
    observer.observe(this.host.nativeElement);
    this.destroyRef.onDestroy(() => observer.disconnect());
  }
}
