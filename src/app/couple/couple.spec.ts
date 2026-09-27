import { TestBed } from '@angular/core/testing';
import { Couple } from './couple';

describe('Couple', () => {
  function create() {
    const fixture = TestBed.createComponent(Couple);
    fixture.detectChanges();
    return fixture;
  }

  const say = (el: Element | null) => el?.textContent?.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

  it('is titled "Наша история" with a warm sentence about the couple, and no date or place', () => {
    const el: HTMLElement = create().nativeElement;
    expect(say(el.querySelector('#couple-title'))).toBe('Наша история');
    expect(say(el.querySelector('.lead'))).toContain('станем одной семьёй');
    expect(el.textContent).not.toMatch(/2026|декабр|Екатеринбург/i);
  });

  it('shows both of the couple\'s own photos with a description, not decoration', () => {
    const el: HTMLElement = create().nativeElement;
    const dinner = el.querySelector('.photo-a') as HTMLImageElement;
    const beach = el.querySelector('.photo-b') as HTMLImageElement;
    expect(dinner.getAttribute('src')).toBe('media/couple-dinner.webp');
    expect(beach.getAttribute('src')).toBe('media/couple-beach.webp');
    expect(dinner.getAttribute('alt')?.length).toBeGreaterThan(10);
    expect(beach.getAttribute('alt')?.length).toBeGreaterThan(10);
    // decoration elsewhere in the site is aria-hidden with alt=""; these two are the point of the section
    expect(dinner.getAttribute('aria-hidden')).toBeNull();
    expect(beach.getAttribute('aria-hidden')).toBeNull();
  });

  it('holds each photo down with decorative tape, not a real control', () => {
    const el: HTMLElement = create().nativeElement;
    const tape = [...el.querySelectorAll('.tape')];
    expect(tape.length).toBe(3); // two pieces on the main photo, one on the smaller one
    for (const piece of tape) expect(piece.getAttribute('aria-hidden')).toBe('true');
  });

  it('is a labelled section headed by its title', () => {
    const el: HTMLElement = create().nativeElement;
    const heading = el.querySelector('#couple-title') as HTMLElement;
    expect(el.querySelector('section')?.getAttribute('aria-labelledby')).toBe(heading.id);
  });

  it('shows the title, divider, sentence and photo board at once where IntersectionObserver is missing', () => {
    const el: HTMLElement = create().nativeElement;
    const parts = [...el.querySelectorAll('[data-reveal]')];
    expect(parts.length).toBe(4); // the title, the divider, the sentence and the photo board
    for (const part of parts) expect(part.classList.contains('is-visible')).toBe(true);
  });

  it('plays the entrance only once the section scrolls into view', () => {
    const observed: { callback: IntersectionObserverCallback }[] = [];
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: IntersectionObserverCallback) {
          observed.push({ callback });
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    const el: HTMLElement = create().nativeElement;
    const board = el.querySelector('.board')!;
    expect(board.classList.contains('is-visible')).toBe(false);

    observed[0].callback([{ isIntersecting: true, target: board } as unknown as IntersectionObserverEntry], {} as IntersectionObserver);
    expect(board.classList.contains('is-visible')).toBe(true);
    vi.unstubAllGlobals();
  });
});
