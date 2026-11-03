import { Injectable, InjectionToken, inject } from '@angular/core';
import { fnv1aHex } from './fnv1a';

/**
 * What every picture and video must be, byte for byte: its path -> "<bytes>:<checksum>" (written at build time into
 * asset-manifest.ts and handed to the app in app.config.ts). Empty by default, which turns the checking off (the
 * unit tests, where nothing is downloaded).
 */
export const MEDIA_FINGERPRINTS = new InjectionToken<Readonly<Record<string, string>>>('MEDIA_FINGERPRINTS', {
  factory: () => ({}),
});

/** How long to wait before each new try after a damaged or failed download. */
export const RETRY_DELAYS_MS = [400, 1000, 2000, 3500, 5000];
/** A download that receives nothing at all for this long is cut off and tried again (it would otherwise hang forever). */
export const SILENCE_LIMIT_MS = 8000;
/** Pictures downloaded at the same time once they are let through (the browser allows 6 per server over http/1.1). */
const PICTURES_AT_ONCE = 4;

const MIME_BY_EXTENSION: Record<string, string> = {
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
};

export function fingerprintOf(bytes: Uint8Array): string {
  return `${bytes.length}:${fnv1aHex(bytes)}`;
}

function withTry(url: string, attempt: number): string {
  return `${url}${url.includes('?') ? '&' : '?'}r=${attempt}`;
}

/** Resolves true after `ms`, or false at once if `signal` is aborted first. */
function pause(ms: number, signal?: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve(false);
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve(true);
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      resolve(false);
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export interface DownloadOptions {
  signal?: AbortSignal;
  /** Called with 0..1 as the bytes arrive (each new try starts again from 0). */
  onProgress?: (fraction: number) => void;
}

interface Waiting {
  url: string;
  /** Downloads the picture and settles its copy; resolves once that is done, whatever the outcome. */
  run: () => Promise<void>;
}

/**
 * Downloads the site's pictures and its video ONCE each, checked byte for byte, and hands out local copies.
 *
 * Why the checking: on some visitors' connections (seen from Russia: a picture served over plain http to a phone there
 * came out half-drawn, or with wrong colours) the bytes are cut short or rewritten on the way, and an <img> or <video>
 * then shows whatever arrived without ever raising an error - so there is nothing to catch. Here the file is
 * downloaded by the page itself, its size and checksum are compared with the ones recorded when the site was built,
 * and only a byte-perfect copy is used (as a local blob). Anything else is downloaded again, bypassing the cache and
 * with a different address each time (some middle-boxes remember the damaged copy), up to six tries; a download that
 * goes silent is cut off and tried again too. If every try fails the caller gets null and lets the browser load the
 * plain address: no worse than an ordinary <img src>.
 *
 * Why the order: the envelope video is what a guest sees first, so while it downloads the pictures are HELD
 * (`hold()`, by the app when the intro is shown) and only start once it is in (`release()`, by the intro). Then every
 * picture of the page is downloaded in the background, a few at a time, in page order - while the video plays - so
 * that by the time the guest scrolls they are already here and nothing pops in late. A picture that comes near the
 * screen before its turn is moved to the front (`hurry()`).
 */
@Injectable({ providedIn: 'root' })
export class MediaLoader {
  private readonly fingerprints = inject(MEDIA_FINGERPRINTS);
  private readonly pictures = new Map<string, Promise<string | null>>();
  private readonly waiting: Waiting[] = [];
  private running = 0;
  private held = false;

  /** The checksum recorded for this path at build time, if any. */
  fingerprint(url: string): string | undefined {
    return this.fingerprints[url];
  }

  /** Keeps pictures from downloading until `release()` (the video goes first). */
  hold(): void {
    this.held = true;
  }

  /** Lets the pictures download. Safe to call more than once. */
  release(): void {
    if (!this.held) return;
    this.held = false;
    this.pump();
  }

  /**
   * A local, checked copy of a picture (the same one for every <img> showing it), or null when it has no recorded
   * checksum or could not be had whole - then the caller uses the plain address.
   */
  picture(url: string): Promise<string | null> {
    let copy = this.pictures.get(url);
    if (!copy) {
      const expected = this.fingerprints[url];
      copy =
        !expected || typeof fetch !== 'function'
          ? Promise.resolve(null)
          : new Promise<string | null>((resolve) =>
              this.waiting.push({
                url,
                run: () =>
                  this.download(url, expected).then(
                    (blob) => resolve(blob ? URL.createObjectURL(blob) : null),
                    () => resolve(null),
                  ),
              }),
            );
      this.pictures.set(url, copy);
      this.pump();
    }
    return copy;
  }

  /** This picture is about to be seen: download it next. */
  hurry(url: string): void {
    const at = this.waiting.findIndex((entry) => entry.url === url);
    if (at > 0) this.waiting.unshift(...this.waiting.splice(at, 1));
  }

  /** Downloads `url` whole and checks it against `expected` ("<bytes>:<checksum>"); null if it never arrived whole. */
  async download(url: string, expected: string, options: DownloadOptions = {}): Promise<Blob | null> {
    const { signal, onProgress } = options;
    const size = Number(expected.split(':')[0]) || 0;
    const extension = url.split('?')[0].split('.').pop()?.toLowerCase() ?? '';

    for (let attempt = 0; ; attempt++) {
      const controller = new AbortController();
      const stop = () => controller.abort();
      signal?.addEventListener('abort', stop, { once: true });
      try {
        const response = await this.fetchWithin(attempt ? withTry(url, attempt) : url, controller, attempt);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const bytes = await this.readAll(response, controller, size, onProgress);
        if (fingerprintOf(bytes) === expected) {
          const type = MIME_BY_EXTENSION[extension] ?? response.headers.get('content-type') ?? '';
          return new Blob([bytes as BlobPart], { type });
        }
      } catch {
        // a failed, silent or damaged download: tried again below
      } finally {
        signal?.removeEventListener('abort', stop);
      }
      if (signal?.aborted) return null;
      if (attempt >= RETRY_DELAYS_MS.length) return null;
      if (!(await pause(RETRY_DELAYS_MS[attempt], signal))) return null;
    }
  }

  private pump(): void {
    while (!this.held && this.running < PICTURES_AT_ONCE && this.waiting.length) {
      const next = this.waiting.shift()!;
      this.running++;
      void next.run().then(() => {
        this.running--;
        this.pump();
      });
    }
  }

  /** `fetch`, cut off if not even the response headers arrive within the silence limit. */
  private fetchWithin(url: string, controller: AbortController, attempt: number): Promise<Response> {
    const timer = setTimeout(() => controller.abort(), SILENCE_LIMIT_MS);
    return fetch(url, { signal: controller.signal, cache: attempt ? 'reload' : 'default' }).finally(() =>
      clearTimeout(timer),
    );
  }

  /** Reads the whole body, reporting progress, and cuts the download off when it goes silent. */
  private async readAll(
    response: Response,
    controller: AbortController,
    size: number,
    onProgress?: (fraction: number) => void,
  ): Promise<Uint8Array> {
    const reader = response.body?.getReader?.();
    if (!reader) return new Uint8Array(await response.arrayBuffer());

    // an aborted download must end even where the stream itself does not notice the abort
    const aborted = new Promise<never>((_, reject) => {
      const fail = () => {
        void reader.cancel?.().catch(() => {});
        reject(new Error('aborted'));
      };
      if (controller.signal.aborted) fail();
      else controller.signal.addEventListener('abort', fail, { once: true });
    });
    aborted.catch(() => {}); // only ever awaited through the race below

    const chunks: Uint8Array[] = [];
    let received = 0;
    onProgress?.(0);
    for (;;) {
      const timer = setTimeout(() => controller.abort(), SILENCE_LIMIT_MS);
      let result: ReadableStreamReadResult<Uint8Array>;
      try {
        result = await Promise.race([reader.read(), aborted]);
      } finally {
        clearTimeout(timer);
      }
      if (result.done) break;
      chunks.push(result.value);
      received += result.value.length;
      if (size) onProgress?.(Math.min(1, received / size));
    }
    const bytes = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return bytes;
  }
}
