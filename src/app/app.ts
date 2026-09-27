import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import { BackgroundMusic } from './background-music/background-music';
import { Home } from './home/home';
import { IntroVideo } from './intro-video/intro-video';

@Component({
  selector: 'app-root',
  imports: [Home, IntroVideo, BackgroundMusic],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  /** The intro overlay is gone (or was never shown). */
  protected readonly introDone = signal(false);
  /** The page may play its entrance animation. */
  protected readonly revealed = signal(false);

  private readonly music = viewChild(BackgroundMusic);

  constructor() {
    // Handy while building: open the site with ?nointro to skip the video.
    if (new URLSearchParams(window.location.search).has('nointro')) {
      this.endIntro();
      // Two frames later, so the page has first been painted in its "before" state and the entrance can animate.
      requestAnimationFrame(() => requestAnimationFrame(() => this.revealed.set(true)));
    }
  }

  /** The video has faded to (almost) nothing: the page's entrance starts now, without waiting for the overlay to go. */
  protected reveal(): void {
    this.revealed.set(true);
  }

  /** The envelope was just tapped: use that same real gesture to unlock the background music too (see
   *  `IntroVideo.opened` / `BackgroundMusic.unlockForGesture`), well before it actually starts playing. */
  protected unlockAudio(): void {
    this.music()?.unlockForGesture();
  }

  /** The intro video has faded out (or cannot be played): from now on the page is the site. */
  protected finishIntro(): void {
    this.endIntro();
    this.revealed.set(true);
  }

  private endIntro(): void {
    this.introDone.set(true);

    const root = document.documentElement;
    root.classList.remove('intro-active');
    root.classList.add('site-ready');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#fdf4eb');
  }
}
