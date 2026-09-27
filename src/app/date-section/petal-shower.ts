import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';

interface Petal {
  id: number;
  /** horizontal start, % of the screen width */
  x: number;
  /** width in px (tiny) */
  w: number;
  /** how solid this petal is (0.2 - 0.85) */
  o: number;
  /** seconds to fall to the middle of the screen */
  fall: number;
  /** seconds before it starts to fall */
  delay: number;
  /** side-to-side drift in px */
  amp: number;
  /** seconds per sweep from one side to the other (the petal turns over once per sweep) */
  swayT: number;
  /** average tilt in degrees */
  rot: number;
}

const COUNT = 48;
/** The petals are all released within this many seconds: a quick burst. */
const EMIT_SECONDS = 1.4;

/**
 * A light, quick shower of tiny rose petals in the site's burgundy, from the top of the screen down to the middle
 * of it (started each time `run` goes up). Each petal has its own size, opacity, speed and sway. Only transforms and opacity are animated (CSS),
 * so it runs on the compositor and cannot make the page stutter; two layers per petal and 48 petals is what keeps
 * even a slow phone smooth (72 petals with three layers each made a software-rendered test browser drop frames).
 * Skipped for guests who prefer reduced motion.
 */
@Component({
  selector: 'app-petal-shower',
  templateUrl: './petal-shower.html',
  styleUrl: './petal-shower.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PetalShower {
  /** Every time this number goes up, a shower starts (unless one is still falling). */
  readonly run = input(0);

  protected readonly petals = signal<Petal[]>([]);
  private handled = 0;
  private falling = false;
  private cleanupTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    effect(() => {
      const run = this.run();
      untracked(() => {
        if (run <= this.handled) return;
        this.handled = run;
        if (!this.falling) this.start();
      });
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(this.cleanupTimer));
  }

  private start(): void {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const petals = this.makePetals();
    this.falling = true;
    this.petals.set(petals);

    // remove the elements once the last petal has gone, and be ready for the next shower
    const end = Math.max(...petals.map((p) => p.delay + p.fall));
    this.cleanupTimer = setTimeout(() => {
      this.petals.set([]);
      this.falling = false;
    }, (end + 1) * 1000);
  }

  private makePetals(): Petal[] {
    // Evenly spread across the width (a jittered row, shuffled), so they never clump.
    const slots = Array.from({ length: COUNT }, (_, i) => i);
    for (let i = slots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [slots[i], slots[j]] = [slots[j], slots[i]];
    }
    const between = (min: number, max: number) => min + Math.random() * (max - min);

    return slots.map((slot, id) => ({
      id,
      x: 2 + ((slot + Math.random()) / COUNT) * 96,
      w: +between(5, 9.5).toFixed(1),
      o: +between(0.2, 0.85).toFixed(2),
      fall: +between(1.7, 2.9).toFixed(2),
      // released in a rapid stream, not all in the same instant
      delay: +((id / COUNT) * EMIT_SECONDS + Math.random() * 0.15).toFixed(2),
      amp: +between(8, 22).toFixed(1),
      swayT: +between(0.9, 1.7).toFixed(2),
      rot: Math.round(between(-40, 40)),
    }));
  }
}
