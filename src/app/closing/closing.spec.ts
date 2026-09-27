import { TestBed } from '@angular/core/testing';
import { Closing } from './closing';

describe('Closing', () => {
  afterEach(() => vi.unstubAllGlobals());

  function create() {
    const fixture = TestBed.createComponent(Closing);
    fixture.detectChanges();
    return fixture;
  }

  it('says goodbye and "made with love", with no name or brand on it', () => {
    const el: HTMLElement = create().nativeElement;
    const section = el.querySelector('section')!;
    expect(section.getAttribute('aria-label')).toBe('До скорой встречи! Сделано с любовью.');
    expect(el.textContent).toContain('До скорой встречи!');
    expect(el.textContent).toContain('Сделано с любовью');
    // no couple's name, no site-builder credit
    expect(el.textContent).not.toMatch(/Шарбель|Анна|Claude|Angular/i);
  });

  it('is decorative to screen readers (the section aria-label carries the meaning once)', () => {
    const el: HTMLElement = create().nativeElement;
    for (const p of el.querySelectorAll('p')) expect(p.getAttribute('aria-hidden')).toBe('true');
  });

  it('has the same two flowers as the welcome section, one on each side', () => {
    const el: HTMLElement = create().nativeElement;
    const left = el.querySelector('.flower-left') as HTMLImageElement;
    const right = el.querySelector('.flower-right') as HTMLImageElement;
    expect(left.getAttribute('src')).toBe('media/flower-left.webp');
    expect(right.getAttribute('src')).toBe('media/flower-right.webp');
    expect(left.getAttribute('aria-hidden')).toBe('true');
    expect(right.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows itself at once where IntersectionObserver is missing', () => {
    const fixture = create();
    expect((fixture.nativeElement as HTMLElement).classList.contains('is-visible')).toBe(true);
  });

  it('plays its entrance only once it scrolls into view', () => {
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

    observed[0].callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    fixture.detectChanges();
    expect(host.classList.contains('is-visible')).toBe(true);
    expect(observed[0].disconnect).toHaveBeenCalled();
  });
});
