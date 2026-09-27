import { TestBed } from '@angular/core/testing';
import { GiftSection } from './gift';

describe('GiftSection', () => {
  afterEach(() => vi.unstubAllGlobals());

  function create() {
    const fixture = TestBed.createComponent(GiftSection);
    fixture.detectChanges();
    return fixture;
  }

  /** the text of an element, with the no-break spaces of the typography turned into plain ones */
  const say = (el: Element | null) => el?.textContent?.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

  it('is titled "О подарках" and says, in Russian, that their love, prayers and presence are the best support', () => {
    const el: HTMLElement = create().nativeElement;

    expect(say(el.querySelector('h2'))).toBe('О подарках');
    const lead = say(el.querySelector('.lead'))!;
    expect(lead).toContain('Лучшая поддержка');
    expect(lead).toContain('любовь');
    expect(lead).toContain('молитвы');
    expect(lead).toContain('присутствие');
  });

  it('asks warmly for a gift in an envelope, as a contribution to the family', () => {
    const el: HTMLElement = create().nativeElement;
    const texts = [...el.querySelectorAll('.text')].map((t) => say(t)!);

    expect(texts.length).toBe(3);
    expect(texts[1]).toContain('конвертом');
    expect(texts[1]).toContain('вкладом');
    expect(texts[1]).toContain('семью');
  });

  it('has the light line about lottery tickets instead of bouquets', () => {
    const el: HTMLElement = create().nativeElement;
    const joke = say([...el.querySelectorAll('.text')].pop()!)!;

    expect(joke).toContain('вместо букетов');
    expect(joke).toContain('лотерейные билеты');
    expect(joke).toContain('повезёт');
  });

  it('writes on the wall', () => {
    const el: HTMLElement = create().nativeElement;
    const src = (selector: string) => el.querySelector(selector)?.getAttribute('src');

    expect(src('.wall')).toBe('media/gift-wall.webp');
    // the wall, the divider and the envelope are decoration
    for (const decoration of el.querySelectorAll('.wall, .divider, .envelope')) expect(decoration.getAttribute('aria-hidden')).toBe('true');
    for (const img of el.querySelectorAll('img')) expect(img.getAttribute('alt')).toBe('');
  });

  it('is a labelled section headed by its title', () => {
    const el: HTMLElement = create().nativeElement;
    const heading = el.querySelector('h2') as HTMLElement;
    expect(el.querySelector('section')?.getAttribute('aria-labelledby')).toBe(heading.id);
  });

  it('does not repeat the wedding date or a place (they have their own sections)', () => {
    const el: HTMLElement = create().nativeElement;
    expect(el.textContent).not.toMatch(/2026|декабр|Екатеринбург/i);
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
        constructor(callback: IntersectionObserverCallback) {
          observed.push({ callback, disconnect: this.disconnect });
        }
        observe() {}
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
