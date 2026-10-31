import { TestBed } from '@angular/core/testing';
import { Invitation } from './invitation';

describe('Invitation', () => {
  afterEach(() => vi.unstubAllGlobals());

  function create() {
    const fixture = TestBed.createComponent(Invitation);
    fixture.detectChanges();
    return fixture;
  }

  it('is written in Russian: the greeting, then the sentence that starts with "Мы" and ends with "!"', () => {
    const el: HTMLElement = create().nativeElement;

    expect(el.querySelector('.dear')?.textContent?.trim()).toBe('Дорогие родные и друзья');
    expect(el.querySelector('.note')?.textContent?.trim()).toBe(
      'Мы будем счастливы разделить с вами день, с которого начнётся наша семья!',
    );
  });

  it('no longer has the line "Вы приглашены ..." or the names above the greeting', () => {
    const el: HTMLElement = create().nativeElement;

    expect(el.textContent).not.toMatch(/приглашены|бракосочетани|Шарбель|Анна/);
    expect(el.querySelector('.kicker, .names')).toBeNull();
  });

  it('does not repeat the wedding date (it has its own section above)', () => {
    const el: HTMLElement = create().nativeElement;
    expect(el.textContent).not.toMatch(/2026|декабр/i);
  });

  it('is named by its greeting for a screen reader', () => {
    const el: HTMLElement = create().nativeElement;
    const heading = el.querySelector('h2') as HTMLElement;

    expect(heading.textContent?.trim()).toBe('Дорогие родные и друзья');
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
