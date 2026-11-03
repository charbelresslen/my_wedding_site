import { DestroyRef, Directive, ElementRef, effect, inject, input, untracked } from '@angular/core';
import { MediaLoader } from './media-loader';

/** A picture this close to the screen is downloaded next, ahead of the rest of the page (see `MediaLoader.hurry`). */
const HURRY_MARGIN = '1200px 0px';

/**
 * A picture that is shown only when it has arrived whole. `<img safeSrc="media/x.webp">` instead of `src`.
 *
 * The bytes come from `MediaLoader` (media-loader.ts: why and how each file is checked before it is used): it
 * downloads every picture of the page once, in the background and in page order, so a picture is usually here long
 * before the guest scrolls to it - including those marked loading="lazy", which only tells the loader that the
 * picture is not on the first screen (a lazy one that comes near the screen before its turn is moved to the front).
 *
 * A path with no recorded fingerprint (or a page without `fetch`) simply gets `src` set at once. Either way the
 * picture stays invisible (styles.css) until its `load` event, so a half-loaded one never shows as an empty box.
 */
@Directive({ selector: 'img[safeSrc]' })
export class SafeImg {
  readonly safeSrc = input.required<string>();

  private readonly img = inject<ElementRef<HTMLImageElement>>(ElementRef).nativeElement;
  private readonly loader = inject(MediaLoader);
  private cancel: (() => void) | undefined;
  /** Marks the picture as drawable once the browser has it (until then styles.css keeps it invisible). */
  private readonly onLoad = () => this.img.setAttribute('data-ready', '');

  constructor() {
    this.img.addEventListener('load', this.onLoad);
    effect(() => {
      const url = this.safeSrc();
      untracked(() => this.start(url));
    });
    inject(DestroyRef).onDestroy(() => {
      this.img.removeEventListener('load', this.onLoad);
      this.stop();
    });
  }

  private start(url: string): void {
    this.stop();
    this.img.removeAttribute('data-ready');
    if (!this.loader.fingerprint(url) || typeof fetch !== 'function') {
      this.img.src = url;
      return;
    }

    let live = true;
    const watcher = this.watchNearScreen(url);
    this.cancel = () => {
      live = false;
      watcher?.disconnect();
    };
    void this.loader.picture(url).then((copy) => {
      if (!live) return;
      watcher?.disconnect();
      // the bytes are already here: there is nothing left for the browser's own lazy loading to wait for
      if (copy) this.img.loading = 'eager';
      this.img.src = copy ?? url;
    });
  }

  /** For a picture below the first screen: download it next once it comes close. */
  private watchNearScreen(url: string): IntersectionObserver | undefined {
    if (this.img.getAttribute('loading') !== 'lazy' || typeof IntersectionObserver !== 'function') return undefined;
    const watcher = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        watcher.disconnect();
        this.loader.hurry(url);
      },
      { rootMargin: HURRY_MARGIN },
    );
    watcher.observe(this.img);
    return watcher;
  }

  private stop(): void {
    this.cancel?.();
    this.cancel = undefined;
  }
}
