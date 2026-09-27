import { TestBed } from '@angular/core/testing';
import { DateSection } from './date-section';
import { PetalShower } from './petal-shower';

interface FakeObserver {
  options: IntersectionObserverInit | undefined;
  callback: IntersectionObserverCallback;
  targets: Element[];
  disconnect: ReturnType<typeof vi.fn>;
}

describe('DateSection', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function create() {
    const fixture = TestBed.createComponent(DateSection);
    fixture.detectChanges();
    return fixture;
  }

  /** Replaces IntersectionObserver by one the test can fire by hand. */
  function fakeObservers(): FakeObserver[] {
    const made: FakeObserver[] = [];
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        disconnect = vi.fn();
        targets: Element[] = [];
        constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
          made.push({ options, callback, targets: this.targets, disconnect: this.disconnect });
        }
        observe(target: Element) {
          this.targets.push(target);
        }
        unobserve() {}
      },
    );
    return made;
  }

  const fire = (observer: FakeObserver, isIntersecting: boolean) =>
    observer.callback([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver);
  const petals = (fixture: { nativeElement: HTMLElement }) => fixture.nativeElement.querySelectorAll('.drift').length;

  /** The two observers of the petals: the one on the middle marker (a band around the centre of the screen) and the "out of sight" one. */
  function petalObservers(made: FakeObserver[]) {
    const band = made.find((o) => o.options?.rootMargin === '-35% 0px -35% 0px')!;
    const away = made.find((o) => o.options?.rootMargin === '-20% 0px -20% 0px')!;
    return { band, away };
  }

  it('shows the wedding month as a calendar, with the 19th marked', () => {
    const el: HTMLElement = create().nativeElement;

    expect(el.querySelector('h2')?.textContent).toContain('декабрь');
    expect(el.querySelector('.year')?.textContent?.trim()).toBe('2026');
    expect([...el.querySelectorAll('.heads span')].map((h) => h.textContent?.trim())).toEqual(['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс']);
    expect(el.querySelector('.heads .is-wedding')?.textContent?.trim()).toBe('сб');
    expect(el.textContent).not.toContain('Сотрите');
    expect(el.querySelector('canvas')).toBeNull();

    // 31 numbered days, in whole weeks, and December 2026 starts on a Tuesday: one empty place before the 1st
    const places = [...el.querySelectorAll('.day')];
    expect(places.length % 7).toBe(0);
    expect(places.length).toBe(35);
    expect(places[0].classList.contains('is-empty')).toBe(true);
    expect(places[1].textContent?.trim()).toBe('1');
    const numbers = places.map((d) => d.textContent?.trim()).filter(Boolean);
    expect(numbers).toEqual(Array.from({ length: 31 }, (_, i) => String(i + 1)));
  });

  it('marks the 19th, and it sits in the Saturday column', () => {
    const el: HTMLElement = create().nativeElement;
    const places = [...el.querySelectorAll('.day')];
    const marked = places.filter((d) => d.classList.contains('is-wedding'));

    expect(marked.length).toBe(1);
    expect(marked[0].textContent?.trim()).toBe('19');
    const column = places.indexOf(marked[0]) % 7;
    expect([...el.querySelectorAll('.heads span')][column].textContent?.trim()).toBe('сб');
  });

  it('says the date in words under the calendar, and gives screen readers one sentence (the calendar is decoration)', () => {
    const el: HTMLElement = create().nativeElement;
    expect(el.querySelector('.caption')?.textContent?.trim()).toBe('Суббота, 19 декабря 2026');
    expect(el.querySelector('.visually-hidden')?.textContent).toContain('Дата свадьбы: 19 декабря 2026 года, суббота.');
    expect(el.querySelector('.card')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('starts no petals by itself, and none where IntersectionObserver is missing', () => {
    const fixture = create();
    expect(petals(fixture)).toBe(0);
  });

  it('lets the petals fall when the middle of the section reaches the middle of the screen, at once', () => {
    const made = fakeObservers();
    const fixture = create();
    const { band } = petalObservers(made);
    expect(band.targets[0].classList.contains('middle')).toBe(true);
    expect(petals(fixture)).toBe(0);

    fire(band, false);
    fixture.detectChanges();
    expect(petals(fixture)).toBe(0);

    fire(band, true);
    fixture.detectChanges();
    expect(petals(fixture)).toBe(48);
  });

  it('falls again when the guest comes back to the section, but not while it is still in view', () => {
    vi.useFakeTimers();
    const made = fakeObservers();
    const fixture = create();
    const { band, away } = petalObservers(made);

    fire(band, true);
    fixture.detectChanges();
    expect(petals(fixture)).toBe(48);
    vi.advanceTimersByTime(8_000); // the shower is over
    fixture.detectChanges();
    expect(petals(fixture)).toBe(0);

    // scrolling around inside the section does not start another one
    fire(band, false);
    fire(band, true);
    fixture.detectChanges();
    expect(petals(fixture)).toBe(0);

    // after the section has been out of sight, the next visit does
    fire(away, false);
    fire(band, true);
    fixture.detectChanges();
    expect(petals(fixture)).toBe(48);
  });

  it('makes tiny burgundy petals with different opacities, released in a quick burst', () => {
    vi.useFakeTimers();
    const made = fakeObservers();
    const fixture = create();
    fire(petalObservers(made).band, true);
    fixture.detectChanges();

    const drifts: HTMLElement[] = [...fixture.nativeElement.querySelectorAll('.drift')];
    const opacities = drifts.map((d) => parseFloat(d.style.getPropertyValue('--o')));
    expect(Math.min(...opacities)).toBeGreaterThanOrEqual(0.2);
    expect(Math.max(...opacities)).toBeLessThanOrEqual(0.85);
    expect(new Set(opacities).size).toBeGreaterThan(15);

    const widths = [...fixture.nativeElement.querySelectorAll('.petal')].map((p) => parseFloat((p as HTMLElement).style.getPropertyValue('--w')));
    expect(Math.max(...widths)).toBeLessThanOrEqual(10);

    // every petal is released within about 1.6 s and falls in under 3 s
    const ends = drifts.map((d) => parseFloat(d.style.getPropertyValue('--delay')) + parseFloat(d.style.getPropertyValue('--fall')));
    expect(Math.max(...ends)).toBeLessThan(4.7);
  });

  it('shows no petals for guests who prefer reduced motion', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), media: query }));
    const made = fakeObservers();
    const fixture = create();
    fire(petalObservers(made).band, true);
    fixture.detectChanges();
    expect(petals(fixture)).toBe(0);
  });

  it('stops watching when it is destroyed', () => {
    const made = fakeObservers();
    const fixture = create();
    const { band, away } = petalObservers(made);
    fixture.destroy();
    expect(band.disconnect).toHaveBeenCalled();
    expect(away.disconnect).toHaveBeenCalled();
  });
});

describe('PetalShower', () => {
  afterEach(() => vi.useRealTimers());

  it('does nothing until it is asked to run', () => {
    const fixture = TestBed.createComponent(PetalShower);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.drift').length).toBe(0);
  });

  it('ignores a new run while a shower is still falling', () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(PetalShower);
    fixture.componentRef.setInput('run', 1);
    fixture.detectChanges();
    const first = [...fixture.nativeElement.querySelectorAll('.drift')];
    expect(first.length).toBe(48);

    fixture.componentRef.setInput('run', 2);
    fixture.detectChanges();
    const second = [...fixture.nativeElement.querySelectorAll('.drift')];
    expect(second).toEqual(first); // the same petals, not a second set
  });
});
