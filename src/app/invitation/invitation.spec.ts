import { TestBed } from '@angular/core/testing';
import { Invitation } from './invitation';

describe('Invitation', () => {
  afterEach(() => vi.unstubAllGlobals());

  function create() {
    const fixture = TestBed.createComponent(Invitation);
    fixture.detectChanges();
    return fixture;
  }

  it('is written in Russian: the invitation line, both names and the closing words', () => {
    const el: HTMLElement = create().nativeElement;

    expect(el.querySelector('.kicker')?.textContent).toContain('Вы приглашены на церемонию бракосочетания');
    expect(el.querySelector('.name-1')?.textContent?.trim()).toBe('Шарбель');
    expect(el.querySelector('.name-2')?.textContent).toContain('Анна');
    expect(el.querySelector('.dear')?.textContent).toContain('Дорогие родные и друзья');
    expect(el.querySelector('.note')?.textContent?.trim().length).toBeGreaterThan(20);
  });

  it('does not repeat the wedding date (it has its own section above)', () => {
    const el: HTMLElement = create().nativeElement;
    expect(el.textContent).not.toMatch(/2026|декабр/i);
  });

  it('has a heading that reads "Шарбель и Анна" to a screen reader (the "&" is only decoration)', () => {
    const el: HTMLElement = create().nativeElement;
    const heading = el.querySelector('h2') as HTMLElement;

    expect(heading.textContent?.replace(/\s+/g, ' ').trim()).toBe('Шарбель &и Анна');
    expect(heading.querySelector('.amp')?.getAttribute('aria-hidden')).toBe('true');
    expect(heading.querySelector('.visually-hidden')?.textContent).toBe('и');
    expect(el.querySelector('section')?.getAttribute('aria-labelledby')).toBe(heading.id);
  });

  it('uses the ZAGS wall and one peony on each side, all of them decoration for screen readers', () => {
    const el: HTMLElement = create().nativeElement;
    const src = (selector: string) => el.querySelector(selector)?.getAttribute('src');

    expect(src('.wall')).toBe('media/zags-wall.webp');
    expect(src('.flower-left img')).toBe('media/peony-left.webp');
    expect(src('.flower-right img')).toBe('media/peony-right.webp');
    for (const img of el.querySelectorAll('img')) expect(img.getAttribute('alt')).toBe('');
    for (const flower of el.querySelectorAll('.flower')) expect(flower.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows itself at once where IntersectionObserver is missing', () => {
    const fixture = create();
    expect((fixture.nativeElement as HTMLElement).classList.contains('is-visible')).toBe(true);
  });

  it('starts its entrance only when scrolled into view, and stops watching afterwards', () => {
    const observed: { callback: IntersectionObserverCallback; disconnect: ReturnType<typeof vi.fn> }[] = [];
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        disconnect = vi.fn();
        observe = vi.fn();
        constructor(callback: IntersectionObserverCallback) {
          observed.push({ callback, disconnect: this.disconnect });
        }
      },
    );

    const fixture = create();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.classList.contains('is-visible')).toBe(false);

    observed[0].callback([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver);
    fixture.detectChanges();
    expect(host.classList.contains('is-visible')).toBe(false);

    observed[0].callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    fixture.detectChanges();
    expect(host.classList.contains('is-visible')).toBe(true);
    expect(observed[0].disconnect).toHaveBeenCalled();
  });
});
