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

  it('is titled "Пожелания"', () => {
    const el: HTMLElement = create().nativeElement;
    expect(say(el.querySelector('h2'))).toBe('Пожелания');
  });

  it("has the four wishes, in the couple's own words, one after the other", () => {
    const el: HTMLElement = create().nativeElement;
    const texts = [...el.querySelectorAll('.text')].map((t) => say(t)!);

    expect(texts.length).toBe(4);
    expect(texts[0]).toBe(
      'Дорогие родные и близкие, если хотите подарить нам ценный и нужный подарок, мы будем очень благодарны за вклад в бюджет нашей молодой семьи.',
    );
    expect(texts[1]).toBe(
      'Вместо мимолётной радости от букета цветов, мы бы хотели испытать свою удачу и с теплом вспоминать вас в то время, когда будем зачёркивать числа на лотерейных билетах. Вдруг нам повезёт!',
    );
    expect(texts[2]).toContain('Если вы планируете подготовить творческое поздравление, пожалуйста, сообщите об этом нашему ведущему:');
    expect(texts[3]).toBe('Если вы захотите принять участие в свадебных аукционах, рекомендуем захватить с собой немного бумажных наличных');
  });

  it('separates the wishes with an ornament (the "***"), not with literal asterisks', () => {
    const el: HTMLElement = create().nativeElement;
    const writing = [...el.querySelector('.writing')!.children].map((c) => (c.classList.contains('sep') ? 'sep' : c.tagName.toLowerCase()));

    expect(writing).toEqual(['h2', 'img', 'p', 'sep', 'p', 'sep', 'p', 'sep', 'p']);
    for (const sep of el.querySelectorAll('.sep')) expect(sep.getAttribute('aria-hidden')).toBe('true');
    expect(el.textContent).not.toContain('*');
  });

  it("gives the host's name and number as a link that calls from a phone", () => {
    const el: HTMLElement = create().nativeElement;
    const phone = el.querySelector<HTMLAnchorElement>('a.phone')!;

    expect(say(phone)).toBe('Илья +7 908 639 7561');
    expect(phone.getAttribute('href')).toBe('tel:+79086397561');
  });

  it('no longer has the earlier envelope wording or the little envelope picture', () => {
    const el: HTMLElement = create().nativeElement;
    expect(el.textContent).not.toMatch(/конверт|молитв/);
    expect(el.querySelector('.envelope')).toBeNull();
  });

  it('writes on the wall', () => {
    const el: HTMLElement = create().nativeElement;
    const src = (selector: string) => el.querySelector(selector)?.getAttribute('src');

    expect(src('.wall')).toBe('media/gift-wall.webp');
    // the wall and the divider are decoration
    for (const decoration of el.querySelectorAll('.wall, .divider')) expect(decoration.getAttribute('aria-hidden')).toBe('true');
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
