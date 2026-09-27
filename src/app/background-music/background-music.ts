import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, effect, inject, input, signal, viewChild } from '@angular/core';

export const MUSIC_SRC = 'media/background-music.mp3';
/** Quiet: it plays under everything a guest does on the page, never over it. */
const VOLUME = 0.4;
const MUTED_STORAGE_KEY = 'wedding-music-muted';

/**
 * Step 12: the site's background music - "Ambient Piano" by AtlasAudio (Pixabay, free licence, see README). Starts
 * the moment the envelope has (almost) finished opening (the same signal that starts the page's own entrance) and
 * loops for as long as the guest stays on the page. Autoplay with sound is refused by some browsers until the
 * visitor has touched the page once, so it follows the exact same fallback as the envelope's own video (try with
 * sound, then silently, then switch the sound on at the very first tap/click/key) instead of ever getting stuck.
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
    if (this.started) return;
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
