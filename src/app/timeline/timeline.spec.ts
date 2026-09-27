import { TestBed } from '@angular/core/testing';
import { Timeline } from './timeline';

describe('Timeline', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    for (const name of ['scrollY', 'innerHeight']) delete (window as unknown as Record<string, unknown>)[name];
    delete (document.documentElement as unknown as Record<string, unknown>)['scrollHeight'];
  });

  function create() {
    const fixture = TestBed.createComponent(Timeline);
    fixture.detectChanges();
    return fixture;
  }

  it('lists the programme in order: 16:00 arrival at the ZAGS, 18:00 welcome drink, 19:00 banquet dinner', () => {
    const el: HTMLElement = create().nativeElement;

    expect(el.querySelector('h2')?.textContent).toContain('Программа дня');
    const steps = [...el.querySelectorAll('ol > li')].map((li) => ({
      time: li.querySelector('time')?.textContent?.trim(),
      label: li.querySelector('.label')?.textContent?.trim(),
    }));
    expect(steps).toEqual([
      { time: '16:00', label: 'Прибытие в ЗАГС' },
      { time: '18:00', label: 'Приветственный напиток' },
      { time: '19:00', label: 'Банкетный ужин' },
    ]);
    expect([...el.querySelectorAll('time')].map((t) => t.getAttribute('datetime'))).toEqual(['16:00', '18:00', '19:00']);
  });

  it('puts the pictures on alternating sides', () => {
    const el: HTMLElement = create().nativeElement;
    const flips = [...el.querySelectorAll('.step')].map((step) => step.classList.contains('step-flip'));
    expect(flips).toEqual([false, true, false]);
  });

  it('draws the rail from the two finials and a rod, and has the flower; every picture is decoration', () => {
    const el: HTMLElement = create().nativeElement;
    const src = (selector: string) => el.querySelector(selector)?.getAttribute('src');

    expect(src('.cap-top')).toBe('media/timeline-top.webp');
    expect(src('.rod')).toBe('media/timeline-rod.webp');
    expect(src('.cap-bottom')).toBe('media/timeline-bottom.webp');
    expect(src('.flower')).toBe('media/timeline-flower.webp');
    expect(src('.rule')).toBe('media/timeline-rule.webp');
    expect([...el.querySelectorAll('.art img')].map((img) => img.getAttribute('src'))).toEqual([
      'media/timeline-arrival.webp',
      'media/timeline-welcome.webp',
      'media/timeline-banquet.webp',
    ]);
    for (const img of el.querySelectorAll('img')) expect(img.getAttribute('alt')).toBe('');
  });

  it('does not repeat the wedding date (it has its own section above)', () => {
    const el: HTMLElement = create().nativeElement;
    expect(el.textContent).not.toMatch(/2026|декабр/i);
  });

  it('shows every part at once where IntersectionObserver is missing', () => {
    const el: HTMLElement = create().nativeElement;
    const parts = [...el.querySelectorAll('[data-reveal]')];
    expect(parts.length).toBe(4); // the heading and the three steps
    for (const part of parts) expect(part.classList.contains('is-visible')).toBe(true);
  });

  it('plays the entrance of each step only when that step scrolls into view', () => {
    const observed: { callback: IntersectionObserverCallback; targets: Element[]; disconnect: ReturnType<typeof vi.fn> }[] = [];
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        targets: Element[] = [];
        disconnect = vi.fn();
        unobserve = vi.fn();
        constructor(callback: IntersectionObserverCallback) {
          observed.push({ callback, targets: this.targets, disconnect: this.disconnect });
        }
        observe(target: Element) {
          this.targets.push(target);
        }
      },
    );

    const fixture = create();
    const steps = [...(fixture.nativeElement as HTMLElement).querySelectorAll('.step')];
    const timelineObserver = observed.find((o) => o.targets.some((t) => t.classList.contains('step')))!;
    expect(steps.every((s) => !s.classList.contains('is-visible'))).toBe(true);

    timelineObserver.callback([{ isIntersecting: true, target: steps[1] } as unknown as IntersectionObserverEntry], {} as IntersectionObserver);
    expect(steps.map((s) => s.classList.contains('is-visible'))).toEqual([false, true, false]);

    fixture.destroy();
    expect(timelineObserver.disconnect).toHaveBeenCalled();
  });

  describe('the flower that rides the rail', () => {
    /**
     * Fake layout: the track starts 1000 px down the page, its first marker is 100 px and its last marker 500 px below
     * the top of the track; the screen is 800 px tall.
     */
    function withLayout(pageHeight: number, reduceMotion = true) {
      vi.stubGlobal('matchMedia', (query: string) => ({ matches: reduceMotion && query.includes('reduce'), media: query }));
      Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
      Object.defineProperty(document.documentElement, 'scrollHeight', { value: pageHeight, configurable: true });
      const scrollTo = (y: number) => {
        Object.defineProperty(window, 'scrollY', { value: y, configurable: true });
        window.dispatchEvent(new Event('scroll'));
      };
      Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
      vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
        let top = 0;
        if (this.classList.contains('track')) top = 1000;
        if (this.classList.contains('node')) {
          const index = [...document.querySelectorAll('.node')].indexOf(this);
          top = 1000 + 100 + index * 200;
        }
        return { top, left: 0, right: 0, bottom: top, width: 0, height: 0, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
      });
      return scrollTo;
    }

    const flowerY = (fixture: { nativeElement: HTMLElement }) => {
      const transform = (fixture.nativeElement.querySelector('.flower') as HTMLElement).style.transform;
      return parseFloat(/translateY\(([-\d.]+)px\)/.exec(transform)?.[1] ?? 'NaN');
    };

    it('waits at the first marker, slides along as the page scrolls, and rests on the last marker', () => {
      const scrollTo = withLayout(6000);
      const fixture = create();

      // the first marker is 100 px into the track: the flower starts there
      expect(flowerY(fixture)).toBeCloseTo(100, 1);

      // it starts moving when the first marker has risen to 70% of the screen (page y 1100 - 560 = 540)
      scrollTo(300);
      expect(flowerY(fixture)).toBeCloseTo(100, 1);
      scrollTo(540);
      expect(flowerY(fixture)).toBeCloseTo(100, 1);

      // and gets to the last marker when that is in the middle of the screen (page y 1500 - 400 = 1100): halfway at 820
      scrollTo(820);
      expect(flowerY(fixture)).toBeCloseTo(300, 1);
      scrollTo(1100);
      expect(flowerY(fixture)).toBeCloseTo(500, 1);

      // never beyond the last marker
      scrollTo(2500);
      expect(flowerY(fixture)).toBeCloseTo(500, 1);
    });

    it('still reaches the last marker when the page ends before that marker gets to the middle of the screen', () => {
      const scrollTo = withLayout(1400); // the page can scroll 600 px at most
      const fixture = create();

      scrollTo(600);
      expect(flowerY(fixture)).toBeCloseTo(500, 1);
    });

    it('glides to its place and turns a little on the way (guests who accept motion), and stops gliding when destroyed', () => {
      vi.useFakeTimers();
      const scrollTo = withLayout(6000, false);
      const fixture = create();
      const turn = () =>
        parseFloat(/rotate\(([-\d.]+)deg\)/.exec((fixture.nativeElement.querySelector('.flower') as HTMLElement).style.transform)?.[1] ?? 'NaN');

      // halfway along the trip (the target is 300 px into the track): not there at once, it glides
      scrollTo(820);
      expect(flowerY(fixture)).toBeCloseTo(100, 0);
      vi.advanceTimersByTime(16 * 4);
      expect(flowerY(fixture)).toBeGreaterThan(100);
      expect(flowerY(fixture)).toBeLessThan(300);

      // ... and arrives; halfway along the rail it has turned half of the 120 degrees
      vi.advanceTimersByTime(2000);
      expect(flowerY(fixture)).toBeCloseTo(300, 0);
      expect(turn()).toBeCloseTo(60, 0);
      expect(vi.getTimerCount()).toBe(0);

      // a glide in progress is cancelled with the component
      scrollTo(1100);
      expect(vi.getTimerCount()).toBe(1);
      fixture.destroy();
      expect(vi.getTimerCount()).toBe(0);
    });

    it('does not turn for guests who prefer reduced motion, and stops listening when destroyed', () => {
      const scrollTo = withLayout(6000);
      const removed = vi.spyOn(window, 'removeEventListener');
      const fixture = create();

      scrollTo(1100);
      expect((fixture.nativeElement.querySelector('.flower') as HTMLElement).style.transform).toContain('rotate(0.0deg)');

      fixture.destroy();
      expect(removed).toHaveBeenCalledWith('scroll', expect.any(Function));
    });
  });
});
