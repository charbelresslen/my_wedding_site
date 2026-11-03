import { TestBed } from '@angular/core/testing';
import { MEDIA_FINGERPRINTS, MediaLoader, SILENCE_LIMIT_MS, fingerprintOf } from './media-loader';

const GOOD = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);

function reply(bytes: Uint8Array) {
  return { ok: true, status: 200, headers: { get: () => null }, arrayBuffer: async () => bytes.buffer.slice(0) };
}

/** A response whose body arrives in the given chunks, then (if `hang`) never finishes. */
function streamed(chunks: Uint8Array[], hang = false) {
  let i = 0;
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    body: {
      getReader: () => ({
        read: () =>
          i < chunks.length
            ? Promise.resolve({ done: false, value: chunks[i++] })
            : hang
              ? new Promise(() => {})
              : Promise.resolve({ done: true, value: undefined }),
      }),
    },
  };
}

describe('MediaLoader', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let created: number;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn(() => Promise.resolve(reply(GOOD)));
    vi.stubGlobal('fetch', fetchMock);
    created = 0;
    URL.createObjectURL = vi.fn(() => `blob:copy-${created++}`);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function loader(paths: string[]) {
    const fingerprints = Object.fromEntries(paths.map((path) => [path, fingerprintOf(GOOD)]));
    TestBed.configureTestingModule({ providers: [{ provide: MEDIA_FINGERPRINTS, useValue: fingerprints }] });
    return TestBed.inject(MediaLoader);
  }

  const settle = () => vi.advanceTimersByTimeAsync(0);
  const fetched = () => fetchMock.mock.calls.map((call) => call[0]);

  it('downloads each picture once and hands every <img> the same local copy', async () => {
    const media = loader(['media/a.webp']);
    const first = media.picture('media/a.webp');
    const second = media.picture('media/a.webp');
    await settle();

    expect(await first).toBe('blob:copy-0');
    expect(await second).toBe('blob:copy-0');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('holds the pictures back until released (the video goes first)', async () => {
    const media = loader(['media/a.webp']);
    media.hold();
    const copy = media.picture('media/a.webp');
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchMock).not.toHaveBeenCalled();

    media.release();
    await settle();
    expect(await copy).toBe('blob:copy-0');
  });

  it('downloads a few at a time in the order asked for, and moves a picture that is about to be seen to the front', async () => {
    const paths = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((name) => `media/${name}.webp`);
    const media = loader(paths);
    const pending: ((value: unknown) => void)[] = [];
    fetchMock.mockImplementation(
      () => new Promise((resolve) => pending.push(() => resolve(reply(GOOD)))) as Promise<unknown>,
    );
    media.hold();
    paths.forEach((path) => void media.picture(path));
    media.hurry('media/g.webp');
    media.release();
    await settle();

    expect(fetched()).toEqual(['media/g.webp', 'media/a.webp', 'media/b.webp', 'media/c.webp']);
    media.hurry('media/f.webp');
    pending.shift()!(undefined);
    await settle();
    expect(fetched().slice(4)).toEqual(['media/f.webp']);
    pending.shift()!(undefined);
    await settle();
    expect(fetched().slice(5)).toEqual(['media/d.webp']);
  });

  it('gives null for a picture without a recorded checksum (the <img> then uses the plain address)', async () => {
    const media = loader([]);
    expect(await media.picture('media/unknown.webp')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports the progress of a download as its bytes arrive', async () => {
    const media = loader([]);
    fetchMock.mockResolvedValue(streamed([GOOD.slice(0, 2), GOOD.slice(2, 6), GOOD.slice(6)]));
    const progress: number[] = [];
    const blob = media.download('media/v.mp4', fingerprintOf(GOOD), { onProgress: (f) => progress.push(f) });
    await settle();

    expect(await blob).toBeInstanceOf(Blob);
    expect(progress).toEqual([0, 0.25, 0.75, 1]);
  });

  it('cuts off a download that goes silent and tries again from a fresh address', async () => {
    const media = loader([]);
    fetchMock
      .mockResolvedValueOnce(streamed([GOOD.slice(0, 3)], true))
      .mockResolvedValueOnce(streamed([GOOD]));
    const blob = media.download('media/v.mp4', fingerprintOf(GOOD));
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(SILENCE_LIMIT_MS + 500);
    expect(fetched()).toEqual(['media/v.mp4', 'media/v.mp4?r=1']);
    expect(await blob).toBeInstanceOf(Blob);
  });

  it('stops when its caller no longer needs the download', async () => {
    const media = loader([]);
    fetchMock.mockResolvedValue(streamed([GOOD.slice(0, 3)], true));
    const controller = new AbortController();
    const blob = media.download('media/v.mp4', fingerprintOf(GOOD), { signal: controller.signal });
    await settle();
    controller.abort();
    await vi.advanceTimersByTimeAsync(60000);

    expect(await blob).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
