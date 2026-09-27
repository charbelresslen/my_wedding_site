import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, inject, signal } from '@angular/core';
import { revealOnView } from '../shared/reveal-on-view';
import { PetalShower } from './petal-shower';

/** The wedding date: 19 December 2026. Change it here; the calendar, the weekday and the sentence follow. */
const WEDDING = { year: 2026, month: 12, day: 19 };

const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const MONTHS_OF_A_DATE = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
/** Monday first, as on a Russian calendar. */
const WEEKDAY_HEADS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
/** In the order of Date.getDay(): Sunday first. */
const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

interface CalendarDay {
  /** 0 = an empty place before the 1st or after the last day */
  day: number;
  wedding: boolean;
}

/** The days of the wedding month, laid out in weeks that start on Monday. */
function buildMonth(): CalendarDay[] {
  const { year, month, day } = WEDDING;
  const daysInMonth = new Date(year, month, 0).getDate();
  const blanksBefore = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const places = Math.ceil((blanksBefore + daysInMonth) / 7) * 7;
  return Array.from({ length: places }, (_, i) => {
    const n = i - blanksBefore + 1;
    return n >= 1 && n <= daysInMonth ? { day: n, wedding: n === day } : { day: 0, wedding: false };
  });
}

/**
 * Step 3: "Дата". The wedding month as a calendar on a soft cream card, the day of the wedding marked by a burgundy
 * disc with a ring that pulses gently. When the middle of the section reaches the middle of the screen a light shower
 * of rose petals falls over the top half of the screen (again each time the guest comes back to it).
 */
@Component({
  selector: 'app-date-section',
  imports: [PetalShower],
  templateUrl: './date-section.html',
  styleUrl: './date-section.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.is-visible]': 'visible()' },
})
export class DateSection {
  protected readonly month = MONTHS[WEDDING.month - 1];
  protected readonly year = WEDDING.year;
  protected readonly days = buildMonth();
  /** The Mon-Sun heads; the one over the day of the wedding is stressed. */
  protected readonly weekdayHeads = WEEKDAY_HEADS.map((text, column) => ({ text, wedding: this.days.findIndex((d) => d.wedding) % 7 === column }));

  private readonly weekday = WEEKDAYS[new Date(WEDDING.year, WEDDING.month - 1, WEDDING.day).getDay()];
  private readonly dateInWords = `${WEDDING.day} ${MONTHS_OF_A_DATE[WEDDING.month - 1]} ${WEDDING.year}`;
  /** Under the calendar: "Суббота, 19 декабря 2026". */
  protected readonly caption = `${this.weekday[0].toUpperCase()}${this.weekday.slice(1)}, ${this.dateInWords}`;
  /** The whole date as a sentence, for screen readers (the calendar itself is decoration to them). */
  protected readonly spoken = `Дата свадьбы: ${this.dateInWords} года, ${this.weekday}.`;

  /** True once the section has scrolled into view (starts its entrance). */
  protected readonly visible = revealOnView(0.25);
  /** Goes up by one each time a shower should start. */
  protected readonly petalsRun = signal(0);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => this.watchMiddle());
  }

  /**
   * Starts a shower when the middle of the section is in the middle of the screen (a band of 30% of the screen height
   * around the centre, so a fast flick cannot skip it), and again the next time the section is scrolled to after it
   * has been out of sight (away from the middle of the screen). Where IntersectionObserver is missing there simply
   * are no petals.
   */
  private watchMiddle(): void {
    if (typeof IntersectionObserver !== 'function') return;
    const marker = this.host.nativeElement.querySelector('.middle');
    const section = this.host.nativeElement.querySelector('.date');
    if (!marker || !section) return;

    let armed = true;
    const band = new IntersectionObserver(
      (entries) => {
        if (armed && entries.some((entry) => entry.isIntersecting)) {
          armed = false;
          this.petalsRun.update((n) => n + 1);
        }
      },
      { rootMargin: '-35% 0px -35% 0px' },
    );
    // "out of sight" = no part of the section within the middle 60% of the screen (a section that merely touches the
    // edge of the screen still counts as intersecting, so the plain viewport would never say "away")
    const away = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => !entry.isIntersecting)) armed = true;
      },
      { rootMargin: '-20% 0px -20% 0px' },
    );
    band.observe(marker);
    away.observe(section);
    this.destroyRef.onDestroy(() => {
      band.disconnect();
      away.disconnect();
    });
  }
}
