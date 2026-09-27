import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';

const VIDEO_SRC = 'media/envelope.mp4';

/** The sealed envelope stays on screen this long (counted from opening the site) before the video starts. */
const AUTOPLAY_DELAY_MS = 800;
/** If the tab was hidden when the delay ended, wait this long after it becomes visible. */
const AUTOPLAY_RESUME_DELAY_MS = 800;

/** Length of the fade into the main page. It is timed to finish as the video ends. */
const FADE_SECONDS = 1.4;
const FADE_SECONDS_REDUCED_MOTION = 0.4;
/** Start slightly early so the overlay is fully transparent by the last frame. */
const FADE_LEAD_SECONDS = 0.1;
const FADE_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';
/**
 * The end of the ease-out is almost invisible, so the page is told the video is gone once this fraction
 * of the fade has passed (the overlay is then only ~15% visible), instead of waiting for the last stretch.
 */
const ALMOST_GONE_FRACTION = 0.55;

/**
 * The poster (identical to frame 0) is dissolved away once the video has presented a frame past frame 0,
 * i.e. once the video layer is proven to be delivering pictures. The dissolve (see .poster in the CSS)
 * hides any small difference between the poster and the moving video, so there is never a step or a flash.
 */
const POSTER_HANDOFF_SECONDS = 0.04;
const POSTER_REMOVE_AFTER_MS = 300; // a little longer than the CSS dissolve

/** Wait this long for the first decoded frame before carrying on anyway (iOS Safari never preloads). */
const FIRST_FRAME_TIMEOUT_MS = 400;

/**
 * - loading: the video file is being read into memory
 * - ready:   fully loaded, waiting for the autoplay delay (or a tap)
 * - playing: playing
 * - fading:  the last moments; overlay is fading out to the main page
 */
type Phase = 'loading' | 'ready' | 'playing' | 'fading';

@Component({
  selector: 'app-intro-video',
  templateUrl: './intro-video.html',
  styleUrl: './intro-video.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(click)': 'onHostClick()' },
})
export class IntroVideo {
  /** Emits once the overlay has fully faded out (or the video cannot be played at all). */
  readonly finished = output<void>();
  /** Emits when the video has faded to (almost) nothing, a little before `finished`. */
  readonly almostGone = output<void>();

  protected readonly phase = signal<Phase>('loading');
  /** True once frames have really played (changes the wording of the tap prompt: open vs continue). */
  protected readonly started = signal(false);
  /** Autoplay was blocked (or the video was paused from outside): show the tap prompt. */
  protected readonly needsTap = signal(false);
  /** The sealed-envelope image on top of the video; dissolved once the video is really showing frames. */
  protected readonly posterVisible = signal(true);
  protected readonly posterFading = signal(false);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly videoRef = viewChild.required<ElementRef<HTMLVideoElement>>('video');

  private readonly abort = new AbortController();
  private readonly openedAt = performance.now();
  private objectUrl: string | undefined;
  private autoplayTimer: ReturnType<typeof setTimeout> | undefined;
  private posterTimer: ReturnType<typeof setTimeout> | undefined;
  private almostGoneTimer: ReturnType<typeof setTimeout> | undefined;
  /** Playing without sound because the browser refused autoplay with sound (until the first gesture). */
  private silent = false;
  private gestureListeners: AbortController | undefined;
  private watchingFrames = false;
  private frameHandle: number | undefined;
  private fadeAnimation: Animation | undefined;

  constructor() {
    afterNextRender(() => void this.preload());

    inject(DestroyRef).onDestroy(() => this.teardown());
  }

  /** Tap / click / Enter on the envelope. Only ever starts playback from inside the user's gesture. */
  protected open(): void {
    if (this.phase() === 'ready') void this.play();
  }

  /** A tap anywhere on the overlay (also on the backdrop beside the video) opens the envelope if it is waiting. */
  protected onHostClick(): void {
    this.open();
  }

  /**
   * Browsers refuse to start sound until the visitor has touched the page once, so when autoplay had to
   * start silently, the FIRST real gesture anywhere (tap, click, key) switches the sound on. There is no
   * button: nothing is drawn over the envelope. `pointerup`/`touchend`/`click`/`keydown` are the events
   * browsers accept as a gesture for touch, mouse and keyboard (`pointerdown` does not count for touch).
   */
  private unmuteOnFirstGesture(): void {
    this.gestureListeners?.abort();
    const controller = (this.gestureListeners = new AbortController());
    const onGesture = () => this.enableSound();
    for (const type of ['pointerup', 'touchend', 'click', 'keydown'] as const) {
      window.addEventListener(type, onGesture, { capture: true, passive: true, signal: controller.signal });
    }
  }

  private enableSound(): void {
    if (!this.silent) return;
    // Modifier keys and the like are not gestures: unmuting without a real one would make Chrome pause the video.
    if (navigator.userActivation && !navigator.userActivation.isActive) return;

    this.silent = false;
    this.gestureListeners?.abort();
    const video = this.videoRef().nativeElement;
    video.muted = false;
    // Safety net: if a browser paused the video because of the unmute, resume it inside this same gesture.
    if (video.paused && !video.ended) void video.play().catch(() => {});
  }

  /** The video is really rendering frames: begin watching its clock for the fade. */
  protected onPlaying(): void {
    if (this.phase() === 'ready') {
      // Resumed from outside (tab back in view, media key, interruption ended): drop the tap prompt.
      this.phase.set('playing');
      this.needsTap.set(false);
    }
    this.started.set(true);
    if (this.watchingFrames) return;
    this.watchingFrames = true;

    const video = this.videoRef().nativeElement;
    const fadeAt = video.duration - this.fadeSeconds() - FADE_LEAD_SECONDS;
    const hasFrameCallback = typeof video.requestVideoFrameCallback === 'function';

    if (hasFrameCallback) {
      // Fires once per presented frame with that frame's exact media time.
      const onFrame: VideoFrameRequestCallback = (_now, metadata) => {
        if (metadata.mediaTime >= POSTER_HANDOFF_SECONDS) this.hidePoster();
        if (metadata.mediaTime >= fadeAt) {
          this.startFade();
          return;
        }
        this.frameHandle = video.requestVideoFrameCallback(onFrame);
      };
      this.frameHandle = video.requestVideoFrameCallback(onFrame);
    }

    // Coarse (about 4 Hz) but universal: backs up the poster removal, and the fade where rVFC is missing.
    video.addEventListener('timeupdate', () => {
      if (video.currentTime >= POSTER_HANDOFF_SECONDS) this.hidePoster();
      if (!hasFrameCallback && video.currentTime >= fadeAt) this.startFade();
    });
  }

  private hidePoster(): void {
    if (this.posterFading()) return;
    this.posterFading.set(true);
    this.posterTimer = setTimeout(() => this.posterVisible.set(false), POSTER_REMOVE_AFTER_MS);
  }

  /**
   * The browser paused the video from outside (phone call, lock screen, headphones unplugged,
   * media keys). Offer the tap again instead of leaving a frozen frame with no way forward.
   */
  protected onPause(): void {
    const video = this.videoRef().nativeElement;
    // 'pause' also fires just before 'ended', and the fade finishes on its own clock.
    if (this.phase() === 'playing' && !video.ended) {
      this.phase.set('ready');
      this.needsTap.set(true);
    }
  }

  /** Also called by the `ended` event as a safety net (e.g. the tab was in the background). */
  protected startFade(): void {
    if (this.phase() === 'fading') return;
    this.phase.set('fading');
    this.hidePoster();

    // Opacity only: runs on the compositor, so it cannot stutter the video.
    // (The audio fade-out is baked into the video file, because iOS ignores video.volume.)
    const durationMs = this.fadeSeconds() * 1000;
    this.fadeAnimation = this.host.nativeElement.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: durationMs,
      easing: FADE_EASING,
      fill: 'forwards',
    });
    this.almostGoneTimer = setTimeout(() => this.almostGone.emit(), durationMs * ALMOST_GONE_FRACTION);
    this.fadeAnimation.finished.then(
      () => this.finished.emit(),
      () => {}, // cancelled because the component was destroyed
    );
  }

  /** The file can't be played by this browser: skip the intro instead of leaving the guest stuck. */
  protected onError(): void {
    if (this.phase() !== 'fading') this.finished.emit();
  }

  private async preload(): Promise<void> {
    const video = this.videoRef().nativeElement;

    // Download the whole file up front (about 5 MB) and play it from memory, so playback can never
    // stall on the network. If that fails for any reason, fall back to normal streaming.
    try {
      const response = await fetch(VIDEO_SRC, { signal: this.abort.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      this.objectUrl = URL.createObjectURL(new Blob([blob], { type: 'video/mp4' }));
      video.src = this.objectUrl;
    } catch {
      if (this.abort.signal.aborted) return;
      video.src = VIDEO_SRC;
    }

    await this.firstFrame(video);
    if (this.abort.signal.aborted) return;

    this.phase.set('ready');

    // Give the guest a moment with the sealed envelope, then open it by itself.
    this.scheduleAutoplay(AUTOPLAY_DELAY_MS - (performance.now() - this.openedAt));
  }

  private scheduleAutoplay(delayMs: number): void {
    clearTimeout(this.autoplayTimer);
    this.autoplayTimer = setTimeout(() => {
      if (this.abort.signal.aborted || this.phase() !== 'ready') return; // a tap already started it
      if (document.visibilityState === 'hidden') {
        // Nobody can see the envelope (background tab): wait until someone can, then a short beat.
        document.addEventListener('visibilitychange', () => this.scheduleAutoplay(AUTOPLAY_RESUME_DELAY_MS), {
          once: true,
          signal: this.abort.signal,
        });
        return;
      }
      void this.autoplay();
    }, Math.max(0, delayMs));
  }

  private firstFrame(video: HTMLVideoElement): Promise<void> {
    return new Promise((resolve) => {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return resolve();
      const done = () => {
        clearTimeout(timer);
        video.removeEventListener('loadeddata', done);
        resolve();
      };
      const timer = setTimeout(done, FIRST_FRAME_TIMEOUT_MS);
      video.addEventListener('loadeddata', done);
    });
  }

  /**
   * Start without a tap. Browsers only allow that with sound in some cases, so: try with sound,
   * then silently (always allowed), and if even that is refused (e.g. iOS Low Power Mode) show the
   * tap prompt so the guest is never stuck.
   */
  private async autoplay(): Promise<void> {
    if (this.phase() !== 'ready') return; // a tap already started it
    const video = this.videoRef().nativeElement;
    this.phase.set('playing');

    try {
      await video.play();
      return;
    } catch {
      if (this.abort.signal.aborted) return;
    }

    video.muted = true;
    this.silent = true;
    this.unmuteOnFirstGesture();
    try {
      await video.play();
      return;
    } catch {
      if (this.abort.signal.aborted) return;
    }

    video.muted = false;
    this.silent = false;
    this.gestureListeners?.abort();
    this.phase.set('ready');
    this.needsTap.set(true);
  }

  /** Playback started by a tap (with sound). */
  private async play(): Promise<void> {
    clearTimeout(this.autoplayTimer);
    const video = this.videoRef().nativeElement;
    this.needsTap.set(false);
    this.phase.set('playing');
    try {
      await video.play();
    } catch {
      if (this.abort.signal.aborted) return;
      this.phase.set('ready');
      this.needsTap.set(true);
    }
  }

  private fadeSeconds(): number {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    return reduced ? FADE_SECONDS_REDUCED_MOTION : FADE_SECONDS;
  }

  private teardown(): void {
    this.abort.abort();
    clearTimeout(this.autoplayTimer);
    clearTimeout(this.posterTimer);
    clearTimeout(this.almostGoneTimer);
    this.gestureListeners?.abort();
    this.fadeAnimation?.cancel();

    const video = this.videoRef().nativeElement;
    if (this.frameHandle !== undefined) video.cancelVideoFrameCallback?.(this.frameHandle);
    // Release the decoder and the in-memory copy of the file.
    video.pause();
    video.removeAttribute('src');
    video.load();
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
  }
}
