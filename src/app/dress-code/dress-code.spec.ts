import { TestBed } from '@angular/core/testing';
import { DressCode } from './dress-code';

describe('DressCode', () => {
  afterEach(() => vi.unstubAllGlobals());

  function create() {
    const fixture = TestBed.createComponent(DressCode);
    fixture.detectChanges();
    return fixture;
  }

  it('is titled "Дресс-код" and invites the guests, in Russian, to wear the shades below', () => {
    const el: HTMLElement = create().nativeElement;
    const say = (selector: string) => el.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();

    expect(el.querySelector('h2')?.textContent).toContain('Дресс-код');
    expect(say('.lead')).toBe('Мы трепетно готовимся к нашему незабываемому дню!');
    expect(say('.ask')).toBe(
      'Нам будет очень приятно, если вы поддержите стилистику нашей свадьбы и, по возможности, используете в ваших нарядах предложенные оттенки:',
    );
    expect(el.querySelector('.script')).toBeNull();
  });

  it('has the small print under the circles: one piece of clothing in the palette is enough', () => {
    const el: HTMLElement = create().nativeElement;
    const hint = el.querySelector('.hint')!;

    expect(hint.querySelectorAll('.line').length).toBe(2); // exactly two lines
    expect([...hint.querySelectorAll('.line')].map((l) => l.textContent).join(' ').replace(/[\s ]+/g, ' ')).toBe(
      '(Не обязательно полностью одеваться в цветовую палитру, достаточно будет одного элемента в одежде по желанию)',
    );
    // after the circles, not before
    expect(el.querySelector('ul.palette')!.compareDocumentPosition(hint) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows the guests in the palette (with a description) and a soft floor shadow', () => {
    const el: HTMLElement = create().nativeElement;
    const photo = el.querySelector<HTMLImageElement>('.crowd')!;

    expect(photo.getAttribute('src')).toBe('media/dress-people.webp');
    expect(photo.alt.length).toBeGreaterThan(20);
    expect(el.querySelector('.floor')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('draws six circles: the four of the user (burgundy, chocolate, mocha, dusty pink) plus black and cream', () => {
    const el: HTMLElement = create().nativeElement;
    const shades = [...el.querySelectorAll('.shade')].map((s) => ({
      name: s.querySelector('.tag')?.textContent?.trim(),
      color: (s.querySelector('.dot') as HTMLElement).style.getPropertyValue('--c'),
    }));

    expect(shades).toEqual([
      { name: 'Бордо', color: '#540f08' },
      { name: 'Шоколад', color: '#321b0d' },
      { name: 'Мокко', color: '#8d6752' },
      { name: 'Пудровый', color: '#cf9f9d' },
      { name: 'Чёрный', color: '#161312' },
      { name: 'Кремовый', color: '#e8cbb1' },
    ]);
  });

  it('makes the last circle exactly the last woman\'s real dress colour, not an invented one', () => {
    const el: HTMLElement = create().nativeElement;
    const last = [...el.querySelectorAll<HTMLElement>('.dot')].pop()!;
    expect(last.style.getPropertyValue('--c')).toBe('#e8cbb1');
  });

  it('names the palette in words for screen readers, and hides the circles themselves', () => {
    const el: HTMLElement = create().nativeElement;
    const list = el.querySelector('ul.palette')!;

    // role=list keeps the list semantics in Safari/VoiceOver (a list with list-style: none loses them there)
    expect(list.getAttribute('role')).toBe('list');
    expect(list.getAttribute('aria-label')).toBe('Палитра');
    expect(list.querySelectorAll('li').length).toBe(6);
    for (const dot of list.querySelectorAll('.dot')) expect(dot.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows every part at once where IntersectionObserver is missing', () => {
    const el: HTMLElement = create().nativeElement;
    const parts = [...el.querySelectorAll('[data-reveal]')];
    expect(parts.length).toBe(5); // the heading, the guests, the sentence, the palette and the small print
    for (const part of parts) expect(part.classList.contains('is-visible')).toBe(true);
  });

  it('plays the entrance of the palette only when it scrolls into view', () => {
    const observers: { callback: IntersectionObserverCallback; targets: Element[] }[] = [];
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        targets: Element[] = [];
        constructor(callback: IntersectionObserverCallback) {
          observers.push({ callback, targets: this.targets });
        }
        observe(target: Element) {
          this.targets.push(target);
        }
        unobserve() {}
        disconnect() {}
      },
    );
    const el: HTMLElement = create().nativeElement;
    const palette = el.querySelector('ul.palette')!;
    expect(palette.classList.contains('is-visible')).toBe(false);

    const revealer = observers.find((o) => o.targets.includes(palette))!;
    revealer.callback([{ isIntersecting: true, target: palette } as unknown as IntersectionObserverEntry], {} as IntersectionObserver);
    expect(palette.classList.contains('is-visible')).toBe(true);
  });
});
