import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, effect, inject, input, signal, viewChild } from '@angular/core';

export const MUSIC_SRC = 'media/background-music.mp3';
/** Quiet: it plays under everything a guest does on the page, never over it. */
const VOLUME = 0.4;
const MUTED_STORAGE_KEY = 'wedding-music-muted';

/**
 * Step 12: the site's background music - "Ambient Piano" by AtlasAudio (Pixabay, free licence, see README). The
 * element is unlocked the instant the envelope is tapped (`unlockForGesture`, called from that same click, before
 * this component's own `playing` input ever turns true - see `app.ts`), then actually starts audible once the
 * envelope has (almost) finished opening (`playing` becomes true, `start()` below). Browsers refuse to start an
 * element's sound without a real gesture, but do not require a fresh one just to mute/unmute an element that is
 * already playing - which is exactly the gap between those two moments that `unlockForGesture` exists to bridge.
 * `start()` also keeps its own try-with-sound / fall back to silent-then-first-gesture path as a defensive fallback,
 * for the rare case `unlockForGesture` was never called (e.g. the `?nointro` debug flag skips the envelope entirely).
 * A small button is the only way to stop audio that starts on its own, which guests should always have; it is kept
 * out of that same "first gesture" listener (see `unmuteOnFirstGesture`), or a tap on it would both toggle the sound
 * itself AND be caught as "the guest's first gesture", undoing each other.
 */
@Component({
  selector: 'app-background-music',
  templateUrl: './background-music.html',
  styleUrl: './background-music.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BackgroundMusic {
  /** True once the envelope has (almost) finished opening: play from here on. */
  readonly playing = input(false);

  protected readonly MUSIC_SRC = MUSIC_SRC;
  /**
   * Always kept equal to the audio element's own `muted` property, the moment it changes for any reason - including
   * the browser forcing it on until the first gesture - so the button never shows a sound state the guest cannot
   * actually hear. Only a tap on the button itself (`toggleMuted`) is a real preference, and only that is saved.
   */
  protected readonly muted = signal(readStoredMuted());

  private readonly audioRef = viewChild.required<ElementRef<HTMLAudioElement>>('audio');
  private readonly buttonRef = viewChild<ElementRef<HTMLButtonElement>>('button');
  private started = false;
  /** Playing without sound because the browser refused autoplay with sound (until the first gesture). */
  private silent = false;
  private gestureListeners: AbortController | undefined;

  constructor() {
    effect(() => {
      if (this.playing()) void this.start();
    });

    inject(DestroyRef).onDestroy(() => this.gestureListeners?.abort());
  }

  /**
   * Called once, synchronously, from inside the envelope's own tap (see `IntroVideo.opened` / `app.html`) — the one
   * reliable real user gesture on this page. Starts the element now, always muted regardless of the guest's stored
   * preference: this call only exists to satisfy the browser's "a real gesture started this" requirement early,
   * before the intro video has even finished. `start()` (below) decides the real audible state moments later, once
   * the intro actually reveals the page — muting/unmuting an already-playing element needs no gesture of its own.
   */
  unlockForGesture(): void {
    if (this.started) return;
    this.started = true;
    const audio = this.audioRef().nativeElement;
    audio.volume = VOLUME;
    audio.muted = true;
    void safePlay(audio);
  }

  /** The mute button. Also doubles as "play" if autoplay never managed to start anything at all. */
  protected toggleMuted(): void {
    this.silent = false; // an explicit choice replaces any "waiting for a gesture" auto-unmute
    this.gestureListeners?.abort();

    const audio = this.audioRef().nativeElement;
    const next = !audio.muted; // toggle the real, current state - never a signal that might be a tick behind it
    this.setMuted(audio, next);
    storeMuted(next); // only an explicit tap is a preference worth remembering for next time
    if (!next && audio.paused) void safePlay(audio);
  }

  private async start(): Promise<void> {
    if (this.started) {
      // Already playing (muted) since the envelope's tap called `unlockForGesture` — reveal sound now, unless the
      // guest's own stored preference is to stay muted (nothing to do in that case; the button reflects it already).
      if (this.muted()) return;
      const audio = this.audioRef().nativeElement;
      this.setMuted(audio, false);
      if (audio.paused) void safePlay(audio);
      return;
    }
    this.started = true;
    const audio = this.audioRef().nativeElement;
    audio.volume = VOLUME;

    if (this.muted()) {
      this.setMuted(audio, true);
      await safePlay(audio);
      return;
    }

    try {
      await audio.play();
      return;
    } catch {
      /* refused: fall through to a silent start below */
    }

    this.setMuted(audio, true);
    this.silent = true;
    this.unmuteOnFirstGesture();
    await safePlay(audio);
  }

  /**
   * The first real gesture ANYWHERE ELSE on the page switches the sound on, exactly like the envelope's own video
   * (see `intro-video.ts`). By the time the music starts, a guest has almost always already interacted with the
   * page once (to open the envelope, or simply because the browser required a touch before autoplaying it), so
   * this fallback rarely has to wait long. A tap on the mute button itself does not count here: `toggleMuted`
   * already decides the outcome for that one on its own.
   */
  private unmuteOnFirstGesture(): void {
    this.gestureListeners?.abort();
    const controller = (this.gestureListeners = new AbortController());
    const onGesture = (event: Event) => {
      const button = this.buttonRef()?.nativeElement;
      if (button && event.target instanceof Node && button.contains(event.target)) return;
      this.enableSound();
    };
    for (const type of ['pointerup', 'touchend', 'click', 'keydown'] as const) {
      window.addEventListener(type, onGesture, { capture: true, passive: true, signal: controller.signal });
    }
  }

  private enableSound(): void {
    if (!this.silent) return;
    if (navigator.userActivation && !navigator.userActivation.isActive) return;
    this.silent = false;
    this.gestureListeners?.abort();

    const audio = this.audioRef().nativeElement;
    this.setMuted(audio, false);
    if (audio.paused) void safePlay(audio);
  }

  /** The one place `audio.muted` is changed, so the button's signal never drifts from what is really playing. */
  private setMuted(audio: HTMLAudioElement, value: boolean): void {
    audio.muted = value;
    this.muted.set(value);
  }
}

/** `audio.play()` refuses (a rejected promise) when autoplay is blocked; wrapping it here is one place to ignore that. */
async function safePlay(audio: HTMLAudioElement): Promise<void> {
  try {
    await audio.play();
  } catch {
    /* refused, or nothing to play yet: nothing more to do here */
  }
}

function readStoredMuted(): boolean {
  try {
    return localStorage.getItem(MUTED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function storeMuted(value: boolean): void {
  try {
    localStorage.setItem(MUTED_STORAGE_KEY, String(value));
  } catch {
    /* private browsing or a full quota: the preference just will not survive a reload, which is fine */
  }
}
