import { DestroyRef, Directive, ElementRef, InjectionToken, effect, inject, input, untracked } from '@angular/core';
import { fnv1aHex } from './fnv1a';

/**
 * What every picture must be, byte for byte: its path -> "<bytes>:<checksum>" (written at build time into
 * asset-manifest.ts and handed to the app in app.config.ts). Empty by default, which turns the checking off (the
 * unit tests, where nothing is downloaded).
 */
export const IMAGE_FINGERPRINTS = new InjectionToken<Readonly<Record<string, string>>>('IMAGE_FINGERPRINTS', {
  factory: () => ({}),
});

/** How long to wait before each new try after a damaged or failed download. */
export const RETRY_DELAYS_MS = [400, 1000, 2000, 3500, 5000];
/** Lazy pictures start downloading when they come this close to the screen. */
const LAZY_MARGIN = '600px 0px';

const MIME_BY_EXTENSION: Record<string, string> = {
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  avif: 'image/avif',
  svg: 'image/svg+xml',
};

export function fingerprintOf(bytes: Uint8Array): string {
  return `${bytes.length}:${fnv1aHex(bytes)}`;
}

function withTry(url: string, attempt: number): string {
  return `${url}${url.includes('?') ? '&' : '?'}r=${attempt}`;
}

/** Resolves true after `ms`, or false at once if `signal` is aborted first. */
function pause(ms: number, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve(false);
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve(true);
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      resolve(false);
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * A picture that is shown only when it has arrived whole. `<img safeSrc="media/x.webp">` instead of `src`.
 *
 * Why: on some visitors' connections (seen from Russia: a picture served over plain http to a phone there came out
 * half-drawn, or with wrong colours) the bytes are cut short or rewritten on the way, and an <img> then paints
 * whatever arrived without ever raising an error - so there is nothing to catch. Here the page downloads the picture
 * itself, compares its size and checksum with the ones recorded when the site was built, and only a byte-perfect copy
 * is handed to the <img> (as a local blob). Anything else is downloaded again, bypassing the cache and with a
 * different address each time (some middle-boxes remember the damaged copy), up to six tries. If all of them fail
 * the browser is let try on its own: no worse than a plain <img src>.
 *
 * A path with no recorded fingerprint (or a page without `fetch`) simply gets `src` set at once. Either way the
 * picture stays invisible (styles.css) until its `load` event, so a half-loaded one never shows as an empty box.
 * Pictures marked loading="lazy" wait until they are near the screen, as the browser would make them.
 */
@Directive({ selector: 'img[safeSrc]' })
export class SafeImg {
  readonly safeSrc = input.required<string>();

  private readonly img = inject<ElementRef<HTMLImageElement>>(ElementRef).nativeElement;
  private readonly fingerprints = inject(IMAGE_FINGERPRINTS);
  private cancel: (() => void) | undefined;
  private objectUrl: string | undefined;
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
    const expected = this.fingerprints[url];
    if (!expected || typeof fetch !== 'function') {
      this.img.src = url;
      return;
    }

    const controller = new AbortController();
    const go = () => void this.download(url, expected, controller.signal);
    if (this.img.getAttribute('loading') === 'lazy' && typeof IntersectionObserver === 'function') {
      const watcher = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          watcher.disconnect();
          go();
        },
        { rootMargin: LAZY_MARGIN },
      );
      watcher.observe(this.img);
      this.cancel = () => {
        controller.abort();
        watcher.disconnect();
      };
    } else {
      this.cancel = () => controller.abort();
      go();
    }
  }

  private async download(url: string, expected: string, signal: AbortSignal): Promise<void> {
    for (let attempt = 0; ; attempt++) {
      try {
        const response = await fetch(attempt ? withTry(url, attempt) : url, {
          signal,
          cache: attempt ? 'reload' : 'default',
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (signal.aborted) return;
        if (fingerprintOf(bytes) === expected) {
          const extension = url.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
          const type = MIME_BY_EXTENSION[extension] ?? response.headers.get('content-type') ?? '';
          this.objectUrl = URL.createObjectURL(new Blob([bytes], { type }));
          // the bytes are already here: there is nothing left for the browser's own lazy loading to wait for
          this.img.loading = 'eager';
          this.img.src = this.objectUrl;
          return;
        }
      } catch {
        if (signal.aborted) return;
      }
      if (attempt >= RETRY_DELAYS_MS.length) break;
      if (!(await pause(RETRY_DELAYS_MS[attempt], signal))) return;
    }
    if (!signal.aborted) this.img.src = url;
  }

  private stop(): void {
    this.cancel?.();
    this.cancel = undefined;
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = undefined;
    }
  }
}
