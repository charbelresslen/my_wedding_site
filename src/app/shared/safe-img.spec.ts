import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { fnv1aHex } from './fnv1a';
import { MEDIA_FINGERPRINTS, RETRY_DELAYS_MS, fingerprintOf } from './media-loader';
import { SafeImg } from './safe-img';

@Component({
  imports: [SafeImg],
  template: `<img [safeSrc]="url()" [attr.loading]="loading()" alt="" />`,
})
class Host {
  readonly url = signal('media/a.webp');
  readonly loading = signal<string | null>(null);
}

const GOOD = new Uint8Array([10, 20, 30, 40, 50, 60]);
const DAMAGED = new Uint8Array([10, 20, 30, 41, 50, 60]); // same length, one byte rewritten
const CUT_SHORT = GOOD.slice(0, 3);

function reply(bytes: Uint8Array, status = 200) {
  return { ok: status < 400, status, headers: { get: () => null }, arrayBuffer: async () => bytes.buffer.slice(0) };
}

describe('SafeImg', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let created: string[];

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn();
    created = [];
    vi.stubGlobal('fetch', fetchMock);
    URL.createObjectURL = vi.fn(() => {
      created.push(`blob:copy-${created.length}`);
      return created[created.length - 1];
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function create(fingerprints: Record<string, string> | null, loading: string | null = null) {
    TestBed.configureTestingModule({
      providers: fingerprints ? [{ provide: MEDIA_FINGERPRINTS, useValue: fingerprints }] : [],
    });
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.loading.set(loading);
    fixture.detectChanges();
    const img = (fixture.nativeElement as HTMLElement).querySelector('img')!;
    return { fixture, img };
  }

  const settle = () => vi.advanceTimersByTimeAsync(0);

  it('computes the same checksum as tools/make-asset-manifest.mjs (FNV-1a, 32 bits)', () => {
    expect(fnv1aHex(new TextEncoder().encode('hello'))).toBe('4f9f2cab');
    expect(fnv1aHex(new Uint8Array())).toBe('811c9dc5');
    expect(fingerprintOf(GOOD)).toMatch(/^6:[0-9a-f]{8}$/);
  });

  it('just sets src when no fingerprints are provided (nothing is downloaded)', async () => {
    const { img } = create(null);
    await settle();

    expect(img.getAttribute('src')).toBe('media/a.webp');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('just sets src for a picture with no recorded fingerprint', async () => {
    const { img } = create({ 'media/other.webp': '1:00000000' });
    await settle();

    expect(img.getAttribute('src')).toBe('media/a.webp');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows nothing until the download has been checked, then a local copy of exactly those bytes', async () => {
    fetchMock.mockResolvedValue(reply(GOOD));
    const { img } = create({ 'media/a.webp': fingerprintOf(GOOD) });

    expect(img.getAttribute('src')).toBeNull();
    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('media/a.webp');
    expect(fetchMock.mock.calls[0][1].cache).toBe('default');
    expect(img.getAttribute('src')).toBe('blob:copy-0');
  });

  it('does not paint a damaged copy: it downloads again, past the cache and from a different address', async () => {
    fetchMock.mockResolvedValueOnce(reply(DAMAGED)).mockResolvedValueOnce(reply(GOOD));
    const { img } = create({ 'media/a.webp': fingerprintOf(GOOD) });
    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(img.getAttribute('src')).toBeNull();

    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe('media/a.webp?r=1');
    expect(fetchMock.mock.calls[1][1].cache).toBe('reload');
    expect(img.getAttribute('src')).toBe('blob:copy-0');
  });

  it('treats a picture cut short, a failed request and an HTTP error the same way: try again', async () => {
    fetchMock
      .mockResolvedValueOnce(reply(CUT_SHORT))
      .mockRejectedValueOnce(new TypeError('network error'))
      .mockResolvedValueOnce(reply(GOOD, 503))
      .mockResolvedValueOnce(reply(GOOD));
    const { img } = create({ 'media/a.webp': fingerprintOf(GOOD) });

    await settle();
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0]);
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[1]);
    expect(img.getAttribute('src')).toBeNull();
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[2]);

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(img.getAttribute('src')).toBe('blob:copy-0');
  });

  it('after six damaged downloads lets the browser load the plain address, as an ordinary <img> would', async () => {
    fetchMock.mockResolvedValue(reply(DAMAGED));
    const { img } = create({ 'media/a.webp': fingerprintOf(GOOD) });

    await settle();
    for (const delay of RETRY_DELAYS_MS) await vi.advanceTimersByTimeAsync(delay);

    expect(fetchMock).toHaveBeenCalledTimes(RETRY_DELAYS_MS.length + 1);
    expect(img.getAttribute('src')).toBe('media/a.webp');
  });

  it('downloads a lazy picture too, in the background, without waiting for it to come near the screen', async () => {
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        disconnect = vi.fn();
        observe = vi.fn();
      },
    );
    fetchMock.mockResolvedValue(reply(GOOD));
    const { img } = create({ 'media/a.webp': fingerprintOf(GOOD) }, 'lazy');
    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(img.getAttribute('src')).toBe('blob:copy-0');
    expect(img.loading).toBe('eager');
  });

  it('is marked ready only when the browser has loaded the picture, and not ready again for a new address', async () => {
    fetchMock.mockResolvedValue(reply(GOOD));
    const { fixture, img } = create({ 'media/a.webp': fingerprintOf(GOOD), 'media/b.webp': fingerprintOf(GOOD) });
    await settle();

    expect(img.hasAttribute('data-ready')).toBe(false);
    img.dispatchEvent(new Event('load'));
    expect(img.hasAttribute('data-ready')).toBe(true);

    fixture.componentInstance.url.set('media/b.webp');
    fixture.detectChanges();
    expect(img.hasAttribute('data-ready')).toBe(false);
  });

  it('follows a changed address', async () => {
    fetchMock.mockResolvedValue(reply(GOOD));
    const { fixture, img } = create({ 'media/a.webp': fingerprintOf(GOOD), 'media/b.webp': fingerprintOf(GOOD) });
    await settle();
    expect(img.getAttribute('src')).toBe('blob:copy-0');

    fixture.componentInstance.url.set('media/b.webp');
    fixture.detectChanges();
    await settle();

    expect(fetchMock.mock.calls[1][0]).toBe('media/b.webp');
    expect(img.getAttribute('src')).toBe('blob:copy-1');
  });

  it('leaves its element alone when it is destroyed before the picture has arrived', async () => {
    fetchMock.mockResolvedValueOnce(reply(DAMAGED)).mockResolvedValue(reply(GOOD));
    const { fixture, img } = create({ 'media/a.webp': fingerprintOf(GOOD) });
    await settle();

    fixture.destroy();
    for (const delay of RETRY_DELAYS_MS) await vi.advanceTimersByTimeAsync(delay);

    expect(img.getAttribute('src')).toBeNull();
  });
});
