import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, inject } from '@angular/core';
import { revealOnView, revealParts } from '../shared/reveal-on-view';

interface Step {
  /** as printed and for the <time> element */
  time: string;
  label: string;
  art: string;
  /** the picture's real pixel size (keeps the layout from jumping while it loads) */
  width: number;
  height: number;
}

/** The programme of the day. Change times and wording here. */
const STEPS: Step[] = [
  { time: '16:00', label: 'Прибытие в ЗАГС', art: 'media/timeline-arrival.webp', width: 560, height: 546 },
  { time: '18:00', label: 'Приветственный напиток', art: 'media/timeline-welcome.webp', width: 560, height: 560 },
  { time: '19:00', label: 'Банкетный ужин', art: 'media/timeline-banquet.webp', width: 560, height: 392 },
];

/**
 * The flower waits at the first marker until that marker has risen to this height on the screen (a fraction of the
 * screen height, from the top), and reaches the last marker when that has risen to FOCUS_END, or when the page can
 * scroll no further, whichever comes first. In between it slides along the rail in step with the scroll, so it is
 * always level with the part of the programme that is at about the middle of the screen.
 */
const FOCUS_START = 0.7;
const FOCUS_END = 0.5;
/** How far the flower has turned when it has travelled the whole timeline. */
const TURN_DEGREES = 120;
/** How quickly the flower catches up with the scroll (0-1 per frame): a soft glide, not a jump. */
const CATCH_UP = 0.2;

/**
 * Step 5: "Программа дня". A vertical timeline: the pictures and times alternate left and right of an ornamental
 * rail, and a flower rides the rail as the guest scrolls, always level with the part of the programme in the
 * middle of the screen (and exactly level with a step's marker when that step is there).
 */
@Component({
  selector: 'app-timeline',
  templateUrl: './timeline.html',
  styleUrl: './timeline.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.is-visible]': 'visible()' },
})
export class Timeline {
  protected readonly steps = STEPS;
  /** True once the section has scrolled into view (the flower appears). */
  protected readonly visible = revealOnView(0.1);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    // each part (the heading, every step) plays its entrance when it scrolls into view
    revealParts(0.3);
    afterNextRender(() => this.followWithFlower());
  }

  /**
   * Moves the flower along the rail. Only a transform of one element is written per frame and nothing is measured
   * while scrolling: the layout is measured once (and again when the size of the timeline changes).
   */
  private followWithFlower(): void {
    const root = this.host.nativeElement;
    const track = root.querySelector<HTMLElement>('.track');
    const flower = root.querySelector<HTMLElement>('.flower');
    const markers = [...root.querySelectorAll<HTMLElement>('.node')];
    if (!track || !flower || !markers.length) return;

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    // measured layout: the top of the track on the page, and the height of the first and last marker inside it
    let trackTop = 0;
    let firstY = 0;
    let lastY = 0;
    let target = 0;
    let current = Number.NaN;
    let frame = 0;

    const centreOf = (element: HTMLElement, trackBox: DOMRect) => {
      const box = element.getBoundingClientRect();
      return box.top + box.height / 2 - trackBox.top;
    };

    const clamp = (value: number) => Math.min(lastY, Math.max(firstY, value));

    const paint = () => {
      const progress = lastY > firstY ? (current - firstY) / (lastY - firstY) : 0;
      const turn = reduceMotion ? 0 : progress * TURN_DEGREES;
      flower.style.transform = `translate(-50%, -50%) translateY(${current.toFixed(2)}px) rotate(${turn.toFixed(1)}deg)`;
    };

    const aim = () => {
      const height = window.innerHeight;
      const room = document.documentElement.scrollHeight - height;
      // the scroll positions at which the flower starts and finishes its trip
      const start = trackTop + firstY - height * FOCUS_START;
      const end = Math.min(trackTop + lastY - height * FOCUS_END, room);
      const along = end > start ? (window.scrollY - start) / (end - start) : 1;
      target = clamp(firstY + Math.min(1, Math.max(0, along)) * (lastY - firstY));
    };

    const glide = () => {
      frame = 0;
      const gap = target - current;
      if (Math.abs(gap) < 0.25) {
        current = target;
        paint();
        return;
      }
      current += gap * CATCH_UP;
      paint();
      frame = requestAnimationFrame(glide);
    };

    const onScroll = () => {
      aim();
      if (reduceMotion || Number.isNaN(current)) {
        current = target;
        paint();
      } else if (!frame) {
        frame = requestAnimationFrame(glide);
      }
    };

    const measure = () => {
      const trackBox = track.getBoundingClientRect();
      trackTop = trackBox.top + window.scrollY;
      firstY = centreOf(markers[0], trackBox);
      lastY = centreOf(markers[markers.length - 1], trackBox);
      aim();
      current = target;
      paint();
    };

    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    const resizeWatcher = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : undefined;
    resizeWatcher?.observe(track);
    // sections added or resized below change where the page ends
    resizeWatcher?.observe(document.body);
    if (!resizeWatcher) window.addEventListener('resize', measure);
    // the script and text sizes settle once the fonts are in
    document.fonts?.ready.then(measure);

    this.destroyRef.onDestroy(() => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', measure);
      resizeWatcher?.disconnect();
      cancelAnimationFrame(frame);
    });
  }
}
