import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';

const VIDEO_SRC = 'media/envelope.mp4';

/**
 * Length of the fade into the main page. envelope.mp4 now cuts, on its own (baked into the file), from the sealed
 * envelope straight to the site's own hero photo at around 6.1s into its ~8.15s length, then holds on that frame
 * to the end - so this fade no longer needs to bridge an "opening" moment itself; it only needs to start safely
 * AFTER that cut (never during it, or the CSS layer would still show the sealed envelope while the real page
 * underneath - already showing the same photo - starts bleeding through, a jarring double image). A short fade
 * is enough (there is no content gap left to bridge, both layers show the same picture), but it must start with a
 * real margin past that cut - about a full second of the video just holding still, undisturbed, before the CSS
 * layer touches anything - or it reads as cutting away too soon, right on the heels of the reveal.
 */
const FADE_SECONDS = 0.9;
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
 * A window wider than 17:20 is "landscape" here: the video cannot fill it without being blown up and cropped to a
 * slice, so it stays whole and its edge colours are carried out to the sides (the same query is in the CSS).
 */
const WIDE_QUERY = '(min-aspect-ratio: 17/20)';
/** The very edge of the video is a darker rim (the raised edge of the envelope): the colours are taken this far in. */
const AMBIENT_INSET_PX = 24;
/** One pixel of the edge-colour canvas stands for this many screen pixels (it is softened anyway). */
const AMBIENT_SCALE = 10;

/**
 * In-app browsers (Telegram, Max, ...) and slow or filtered connections sometimes leave a video neither playing nor
 * failing: the tap was made, nothing moves, nothing ever happens. So playback is watched, and if the picture does not
 * start within START_LIMIT_MS, or stands still for STALL_LIMIT_MS once running, the intro is given up and the guest
 * is taken on to the invitation instead of being left on a frozen envelope.
 */
const WATCH_INTERVAL_MS = 500;
const START_LIMIT_MS = 7000;
const STALL_LIMIT_MS = 4500;
/** The "Загрузка…" caption is shown once the picture has been standing still this long. */
const SHOW_WAIT_AFTER_MS = 800;

/**
 * - loading: the video's first frame is still buffering
 * - ready:   a frame is ready; waiting for a tap
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
  /** Whether to show the "tap to open" prompt: true once ready, and again if the video was paused from outside. */
  protected readonly needsTap = signal(false);
  /** The sealed-envelope image on top of the video; dissolved once the video is really showing frames. */
  protected readonly posterVisible = signal(true);
  protected readonly posterFading = signal(false);
  /** The video was started but is not moving (yet): its data is still arriving. */
  protected readonly buffering = signal(false);
  /** A landscape window: the spare sides are painted from the video's own edges (see the CSS, `.ambient`). */
  protected readonly wide = signal(false);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly videoRef = viewChild.required<ElementRef<HTMLVideoElement>>('video');
  private readonly ambient = viewChild<ElementRef<HTMLCanvasElement>>('ambient');
  private readonly layoutCleanup: (() => void)[] = [];

  private readonly abort = new AbortController();
  private posterTimer: ReturnType<typeof setTimeout> | undefined;
  private almostGoneTimer: ReturnType<typeof setTimeout> | undefined;
  private watchingFrames = false;
  private frameHandle: number | undefined;
  private fadeAnimation: Animation | undefined;
  private watchdog: ReturnType<typeof setInterval> | undefined;
  private lastTime = -1;
  private lastProgressAt = 0;

  constructor() {
    afterNextRender(() => {
      this.watchLayout();
      void this.preload();
    });
    // the edge-colour canvas appears when the window turns landscape: size it and paint it at once
    effect(() => {
      const canvas = this.ambient()?.nativeElement;
      if (canvas) this.paintAmbient();
    });

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

  /** The video is really rendering frames: begin watching its clock for the fade. */
  protected onPlaying(): void {
    if (this.phase() === 'ready') {
      // Resumed from outside (tab back in view, media key, interruption ended): drop the tap prompt.
      this.phase.set('playing');
      this.needsTap.set(false);
      this.startWatching();
    }
    this.started.set(true);
    this.noteProgress();
    if (this.watchingFrames) return;
    this.watchingFrames = true;

    const video = this.videoRef().nativeElement;
    const fadeAt = video.duration - this.fadeSeconds() - FADE_LEAD_SECONDS;
    const hasFrameCallback = typeof video.requestVideoFrameCallback === 'function';

    if (hasFrameCallback) {
      // Fires once per presented frame with that frame's exact media time.
      const onFrame: VideoFrameRequestCallback = (_now, metadata) => {
        this.paintAmbient();
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
      if (!hasFrameCallback) this.paintAmbient();
      if (video.currentTime >= POSTER_HANDOFF_SECONDS) this.hidePoster();
      if (!hasFrameCallback && video.currentTime >= fadeAt) this.startFade();
    });
  }

  /** Paints the sides of a landscape window from the columns just inside the left and right edges of the video's current frame. */
  protected paintAmbient(): void {
    const canvas = this.ambient()?.nativeElement;
    const video = this.videoRef().nativeElement;
    if (!canvas || !video.videoWidth || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;

    const { clientWidth, clientHeight } = this.host.nativeElement;
    const width = Math.max(2, Math.ceil(clientWidth / AMBIENT_SCALE));
    const height = Math.max(2, Math.ceil(clientHeight / AMBIENT_SCALE));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const context = canvas.getContext('2d');
    if (!context) return;

    // the video is as tall as the screen here: whatever is left of the width on either side is the band to fill
    const band = Math.max(0, (width - (height * 9) / 16) / 2) + 2;
    context.drawImage(video, AMBIENT_INSET_PX, 0, 2, video.videoHeight, 0, 0, band, height);
    context.drawImage(video, video.videoWidth - AMBIENT_INSET_PX - 2, 0, 2, video.videoHeight, width - band, 0, band, height);
  }

  private watchLayout(): void {
    const query = window.matchMedia?.(WIDE_QUERY);
    if (query) {
      this.wide.set(query.matches);
      const onChange = () => this.wide.set(query.matches);
      query.addEventListener?.('change', onChange);
      this.layoutCleanup.push(() => query.removeEventListener?.('change', onChange));
    }
    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(() => this.paintAmbient());
      observer.observe(this.host.nativeElement);
      this.layoutCleanup.push(() => observer.disconnect());
    }
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
      this.buffering.set(false);
    }
  }

  /** Also called by the `ended` event as a safety net (e.g. the tab was in the background). */
  protected startFade(): void {
    if (this.phase() === 'fading') return;
    this.phase.set('fading');
    this.stopWatching();
    this.buffering.set(false);
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
    // `preload="auto"` on the element (see the template) streams the file progressively, so first-frame
    // readiness only needs however much has buffered so far, not the whole ~1.6 MB file.
    video.src = VIDEO_SRC;

    await this.firstFrame(video);
    if (this.abort.signal.aborted) return;
    this.paintAmbient();

    this.phase.set('ready');
    // Always require a tap now: it is also the one reliable place to start sound (see `play()`).
    this.needsTap.set(true);
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

  /** Playback started by a tap (with sound). This is the ONLY way the video ever starts. */
  private async play(): Promise<void> {
    const video = this.videoRef().nativeElement;
    this.needsTap.set(false);
    this.phase.set('playing');
    this.startWatching();
    try {
      await video.play();
    } catch {
      if (this.abort.signal.aborted) return;
      this.stopWatching();
      this.phase.set('ready');
      this.needsTap.set(true);
    }
  }

  /** From the tap on: look twice a second whether the picture is moving. */
  private startWatching(): void {
    this.stopWatching();
    this.lastTime = -1;
    this.lastProgressAt = performance.now();
    this.watchdog = setInterval(() => this.checkProgress(), WATCH_INTERVAL_MS);
  }

  private stopWatching(): void {
    clearInterval(this.watchdog);
    this.watchdog = undefined;
  }

  /** The clock of the video moved (or the video said it is playing): it is alive. */
  private noteProgress(): void {
    this.lastProgressAt = performance.now();
    this.buffering.set(false);
  }

  private checkProgress(): void {
    if (this.phase() !== 'playing') {
      this.lastProgressAt = performance.now();
      return;
    }
    const video = this.videoRef().nativeElement;
    if (video.currentTime !== this.lastTime) {
      this.lastTime = video.currentTime;
      this.noteProgress();
      return;
    }
    const stoodStill = performance.now() - this.lastProgressAt;
    if (stoodStill > (this.started() ? STALL_LIMIT_MS : START_LIMIT_MS)) {
      this.giveUp();
    } else if (stoodStill > SHOW_WAIT_AFTER_MS) {
      this.buffering.set(true);
    }
  }

  /** The video will not run in this browser (or on this connection): on to the invitation. */
  private giveUp(): void {
    this.stopWatching();
    this.videoRef().nativeElement.pause();
    this.startFade();
  }

  private fadeSeconds(): number {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    return reduced ? FADE_SECONDS_REDUCED_MOTION : FADE_SECONDS;
  }

  private teardown(): void {
    this.abort.abort();
    this.stopWatching();
    for (const stop of this.layoutCleanup) stop();
    clearTimeout(this.posterTimer);
    clearTimeout(this.almostGoneTimer);
    this.fadeAnimation?.cancel();

    const video = this.videoRef().nativeElement;
    if (this.frameHandle !== undefined) video.cancelVideoFrameCallback?.(this.frameHandle);
    // Release the decoder.
    video.pause();
    video.removeAttribute('src');
    video.load();
  }
}
