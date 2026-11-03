import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MEDIA_FINGERPRINTS, fingerprintOf } from '../shared/media-loader';
import { IntroVideo } from './intro-video';

describe('IntroVideo download', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
    HTMLMediaElement.prototype.pause = vi.fn();
    HTMLMediaElement.prototype.load = vi.fn();
    URL.createObjectURL = vi.fn(() => 'blob:whole-video');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('downloads the whole video before offering the tap, showing how far it has got', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    let rest!: () => void;
    const restArrived = new Promise<void>((resolve) => (rest = resolve));
    const reads = [
      () => Promise.resolve({ done: false, value: bytes.slice(0, 2) }),
      () => restArrived.then(() => ({ done: false, value: bytes.slice(2) })),
      () => Promise.resolve({ done: true, value: undefined }),
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, body: { getReader: () => ({ read: () => reads.shift()!() }) } }),
      ),
    );
    TestBed.configureTestingModule({
      providers: [{ provide: MEDIA_FINGERPRINTS, useValue: { 'media/envelope.mp4': fingerprintOf(bytes) } }],
    });

    const fixture = TestBed.createComponent(IntroVideo);
    fixture.detectChanges();
    TestBed.inject(ApplicationRef).tick();
    const el: HTMLElement = fixture.nativeElement;
    await vi.advanceTimersByTimeAsync(3000);
    fixture.detectChanges();

    expect(el.querySelector('.caption.wait')?.textContent).toContain('50%');
    expect(el.querySelector('button.tap')).toBeNull();
    expect(el.querySelector('video')!.getAttribute('src')).toBeNull();

    rest();
    await vi.advanceTimersByTimeAsync(500);
    fixture.detectChanges();
    expect(el.querySelector('video')!.getAttribute('src')).toBe('blob:whole-video');
    expect(el.querySelector('button.tap')).toBeTruthy();
  });
});

describe('IntroVideo', () => {
  let animate: ReturnType<typeof vi.fn>;
  let time: { value: number };

  beforeEach(() => {
    vi.useFakeTimers();
    animate = vi.fn(() => ({ finished: new Promise(() => {}), cancel: () => {} }));
    (HTMLElement.prototype as unknown as { animate: unknown }).animate = animate;
    HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
    HTMLMediaElement.prototype.pause = vi.fn();
    HTMLMediaElement.prototype.load = vi.fn();
    time = { value: 0 };
  });

  afterEach(() => vi.useRealTimers());

  /** The overlay, tapped open; `time` is the clock of its (pretend) video. */
  async function tapped() {
    const fixture = TestBed.createComponent(IntroVideo);
    fixture.detectChanges();
    TestBed.inject(ApplicationRef).tick();
    const el: HTMLElement = fixture.nativeElement;
    const video = el.querySelector('video')!;
    Object.defineProperty(video, 'currentTime', { get: () => time.value, configurable: true });
    Object.defineProperty(video, 'duration', { get: () => 8, configurable: true });

    await vi.advanceTimersByTimeAsync(500); // the first-frame wait
    fixture.detectChanges();
    el.querySelector<HTMLButtonElement>('button.tap')!.click();
    fixture.detectChanges();
    return { fixture, el, video };
  }

  it('gives up and goes on to the invitation when the video never starts after the tap', async () => {
    const { video } = await tapped();

    await vi.advanceTimersByTimeAsync(6500);
    expect(animate).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1500);

    expect(animate).toHaveBeenCalledTimes(1);
    expect(video.pause).toHaveBeenCalled();
  });

  it('gives up when a playing video stands still', async () => {
    const { video } = await tapped();
    video.dispatchEvent(new Event('playing'));
    time.value = 2;
    await vi.advanceTimersByTimeAsync(1000);

    await vi.advanceTimersByTimeAsync(4000);
    expect(animate).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1500);

    expect(animate).toHaveBeenCalledTimes(1);
  });

  it('shows the waiting caption while a started video is not moving, and takes it away when it moves', async () => {
    const { fixture, el, video } = await tapped();
    video.dispatchEvent(new Event('playing'));
    await vi.advanceTimersByTimeAsync(2000);
    fixture.detectChanges();
    expect(el.querySelector('.caption.wait')).toBeTruthy();

    time.value = 3;
    await vi.advanceTimersByTimeAsync(600);
    fixture.detectChanges();
    expect(el.querySelector('.caption.wait')).toBeNull();
  });

  it('keeps going while the clock of the video moves', async () => {
    const { video } = await tapped();
    video.dispatchEvent(new Event('playing'));
    for (let i = 1; i <= 24; i++) {
      time.value = i * 0.25;
      await vi.advanceTimersByTimeAsync(1000);
    }
    expect(animate).not.toHaveBeenCalled();
  });

  it('fades out only once the pictures of the first screen under it are here', async () => {
    const pictures: (() => void)[] = [];
    const bytes = new Uint8Array([9, 8, 7]);
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise((resolve) =>
            pictures.push(() =>
              resolve({ ok: true, status: 200, headers: { get: () => null }, arrayBuffer: async () => bytes.buffer.slice(0) }),
            ),
          ),
      ),
    );
    URL.createObjectURL = vi.fn(() => 'blob:picture');
    const fingerprints = Object.fromEntries(
      ['media/hero-couple.webp', 'media/divider.webp', 'media/flower-left.webp', 'media/flower-right.webp'].map((path) => [
        path,
        fingerprintOf(bytes),
      ]),
    );
    TestBed.configureTestingModule({ providers: [{ provide: MEDIA_FINGERPRINTS, useValue: fingerprints }] });

    const { video } = await tapped();
    video.dispatchEvent(new Event('playing'));
    video.dispatchEvent(new Event('ended'));
    await vi.advanceTimersByTimeAsync(1000);
    expect(animate).not.toHaveBeenCalled();

    pictures.forEach((arrive) => arrive());
    await vi.advanceTimersByTimeAsync(0);
    expect(animate).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('does not watch a video that was paused from outside (it asks for a tap again)', async () => {
    const { fixture, el, video } = await tapped();
    video.dispatchEvent(new Event('playing'));
    time.value = 1;
    await vi.advanceTimersByTimeAsync(600);
    video.dispatchEvent(new Event('pause'));
    fixture.detectChanges();

    await vi.advanceTimersByTimeAsync(20000);
    expect(animate).not.toHaveBeenCalled();
    expect(el.querySelector('button.tap')).toBeTruthy();
  });
});

describe('IntroVideo in a landscape window', () => {
  let drawImage: ReturnType<typeof vi.fn>;

  function landscape(matches: boolean) {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: matches && query.includes('min-aspect-ratio'),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  }

  beforeEach(() => {
    vi.useFakeTimers();
    drawImage = vi.fn();
    HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
    HTMLMediaElement.prototype.pause = vi.fn();
    HTMLMediaElement.prototype.load = vi.fn();
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage })) as never;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function shown() {
    const fixture = TestBed.createComponent(IntroVideo);
    fixture.detectChanges();
    TestBed.inject(ApplicationRef).tick();
    const video = (fixture.nativeElement as HTMLElement).querySelector('video')!;
    Object.defineProperty(video, 'videoWidth', { get: () => 720, configurable: true });
    Object.defineProperty(video, 'videoHeight', { get: () => 1280, configurable: true });
    Object.defineProperty(video, 'readyState', { get: () => 4, configurable: true });
    await vi.advanceTimersByTimeAsync(500);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement, video };
  }

  it('has no edge-colour canvas on a phone (the video fills the screen by itself)', async () => {
    landscape(false);
    const { el } = await shown();
    expect(el.querySelector('canvas.ambient')).toBeNull();
  });

  it("paints the spare sides of a landscape window from the video's own columns beside its left and right edges", async () => {
    landscape(true);
    const { fixture, el, video } = await shown();
    fixture.detectChanges();
    expect(el.querySelector('canvas.ambient')).toBeTruthy();

    drawImage.mockClear();
    video.dispatchEvent(new Event('loadeddata'));
    expect(drawImage).toHaveBeenCalledTimes(2);
    const [left, right] = drawImage.mock.calls;
    expect(left.slice(1, 5)).toEqual([24, 0, 2, 1280]); // two columns just inside the left edge (the rim is left out)
    expect(right.slice(1, 5)).toEqual([694, 0, 2, 1280]); // and just inside the right one
  });
});
