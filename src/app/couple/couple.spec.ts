import { TestBed } from '@angular/core/testing';
import { Couple } from './couple';

describe('Couple', () => {
  function create() {
    const fixture = TestBed.createComponent(Couple);
    fixture.detectChanges();
    return fixture;
  }

  const say = (el: Element | null) => el?.textContent?.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

  it('shows a warm sentence about the couple (no date or place) and no hyphen before "и с трепетом"', () => {
    const el: HTMLElement = create().nativeElement;
    expect(say(el.querySelector('.lead'))).toBe(
      'Мы благодарны судьбе за каждый день, что привёл нас друг к другу, и с трепетом ждём дня, когда мы официально станем одной семьёй.',
    );
    expect(say(el.querySelector('.lead'))).not.toMatch(/[—–-]/);
    expect(el.textContent).not.toMatch(/2026|декабр|Екатеринбург/i);
  });

  it('no longer shows the title "Наша история", but a screen reader still gets it', () => {
    const el: HTMLElement = create().nativeElement;
    const heading = el.querySelector('#couple-title') as HTMLElement;
    expect(say(heading)).toBe('Наша история');
    expect(heading.classList.contains('visually-hidden')).toBe(true);
    expect(heading.hasAttribute('data-reveal')).toBe(false);
  });

  it('has the same ornament above and below the sentence', () => {
    const el: HTMLElement = create().nativeElement;
    const children = [...el.querySelector('.col')!.children].map((c) => c.className.split(' ').find((n) => n !== 'reveal'));
    const sentence = children.indexOf('lead');
    expect(children[sentence - 1]).toBe('divider');
    expect(children[sentence + 1]).toBe('divider');
    for (const divider of el.querySelectorAll('.divider')) {
      expect(divider.getAttribute('src')).toBe('media/divider.webp');
      expect(divider.getAttribute('aria-hidden')).toBe('true');
    }
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

  it('is a labelled section', () => {
    const el: HTMLElement = create().nativeElement;
    const heading = el.querySelector('#couple-title') as HTMLElement;
    expect(el.querySelector('section')?.getAttribute('aria-labelledby')).toBe(heading.id);
  });

  it('shows both ornaments, the sentence and the photo board at once where IntersectionObserver is missing', () => {
    const el: HTMLElement = create().nativeElement;
    const parts = [...el.querySelectorAll('[data-reveal]')];
    expect(parts.length).toBe(4); // the two ornaments, the sentence and the photo board
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
