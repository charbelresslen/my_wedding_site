import { TestBed } from '@angular/core/testing';
import { LocationSection } from './location';

describe('LocationSection', () => {
  afterEach(() => vi.unstubAllGlobals());

  function create() {
    const fixture = TestBed.createComponent(LocationSection);
    fixture.detectChanges();
    return fixture;
  }

  it('is titled "Локация" and shows the ceremony first, then the banquet', () => {
    const el: HTMLElement = create().nativeElement;

    expect(el.querySelector('h2')?.textContent).toContain('Локация');
    expect([...el.querySelectorAll('.venue .role')].map((r) => r.textContent?.trim())).toEqual(['Церемония', 'Банкет']);
  });

  it('gives the city, the name and the street of each place, all in Russian', () => {
    const el: HTMLElement = create().nativeElement;
    const venues = [...el.querySelectorAll('.venue')].map((v) => ({
      city: v.querySelector('.city')?.textContent?.trim(),
      name: v.querySelector('.name')?.textContent?.trim(),
      address: v.querySelector('.address')?.textContent?.trim(),
    }));

    expect(venues).toEqual([
      { city: 'Екатеринбург', name: 'Дворец бракосочетания', address: 'улица Карла Либкнехта, 3' },
      { city: 'Екатеринбург', name: 'Отель «Гранд Авеню»', address: 'проспект Ленина, 40' },
    ]);
  });

  it('shows a photo of each place (with a description) and a sprig of flowers on its corner, and the peony at the top', () => {
    const el: HTMLElement = create().nativeElement;
    const photos = [...el.querySelectorAll<HTMLImageElement>('.photo')];

    expect(photos.map((p) => p.getAttribute('src'))).toEqual(['media/loc-zags.webp', 'media/loc-hotel.webp']);
    for (const photo of photos) expect(photo.alt.length).toBeGreaterThan(10);
    expect([...el.querySelectorAll('.sprig')].map((s) => s.getAttribute('src'))).toEqual(['media/loc-sprig.webp', 'media/loc-sprig.webp']);
    expect(el.querySelector('.head .peony')?.getAttribute('src')).toBe('media/loc-peony.webp');
    // the flowers are decoration
    for (const decoration of el.querySelectorAll('.sprig, .peony, .divider')) expect(decoration.getAttribute('aria-hidden')).toBe('true');
  });

  it('puts a framed map with an "open in Yandex Maps" button under each photo', () => {
    const el: HTMLElement = create().nativeElement;
    const maps = [...el.querySelectorAll('app-venue-map')];
    expect(maps.length).toBe(2);

    const buttons = maps.map((m) => m.querySelector<HTMLAnchorElement>('a.button')!);
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(['Открыть в Яндекс Картах', 'Открыть в Яндекс Картах']);
    expect(buttons[0].href).toContain('yandex.ru/maps/org/upravleniye_zags_sverdlovskoy_oblasti_dvorets_brakosochetaniya/125502093405');
    expect(buttons[1].href).toContain('yandex.ru/maps/54/yekaterinburg/house/prospekt_lenina_40');
    for (const button of buttons) {
      expect(button.target).toBe('_blank');
      expect(button.rel).toContain('noopener');
    }
    expect(buttons[0].getAttribute('aria-label')).toBe('Открыть в Яндекс Картах: Дворец бракосочетания, улица Карла Либкнехта, 3');
  });

  it('points each map picture and button at the exact spot Yandex gives for the place', () => {
    const el: HTMLElement = create().nativeElement;
    const links = [...el.querySelectorAll<HTMLAnchorElement>('app-venue-map a.button')].map((a) => a.href);
    const pictures = [...el.querySelectorAll('app-venue-map .preview')].map((p) => p.getAttribute('src'));

    expect(links[0]).toContain('ll=60.612029%2C56.836194');
    expect(links[1]).toContain('ll=60.612638%2C56.838967');
    expect(pictures[0]).toContain('static-maps.yandex.ru');
    expect(pictures[0]).toContain('ll=60.612029,56.836194');
    expect(pictures[1]).toContain('ll=60.612638,56.838967');
  });

  it('loads no movable map when the page opens (a heavy page: only when a map is tapped): the maps start as pictures', () => {
    const el: HTMLElement = create().nativeElement;
    expect(el.querySelectorAll('iframe').length).toBe(0);
    expect(el.querySelectorAll('app-venue-map .preview').length).toBe(2);
  });

  it('has each place as its own labelled article, headed by its role', () => {
    const el: HTMLElement = create().nativeElement;
    for (const article of el.querySelectorAll('article')) {
      const heading = article.querySelector('h3') as HTMLElement;
      expect(article.getAttribute('aria-labelledby')).toBe(heading.id);
    }
  });

  it('shows every part at once where IntersectionObserver is missing', () => {
    const el: HTMLElement = create().nativeElement;
    const parts = [...el.querySelectorAll('[data-reveal]')];
    expect(parts.length).toBe(7); // the heading, and for each place its text, photo and map
    for (const part of parts) expect(part.classList.contains('is-visible')).toBe(true);
  });

  it('plays the entrance of each part only when that part scrolls into view', () => {
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
    const revealer = observers.find((o) => o.targets.some((t) => t.classList.contains('shot')))!;
    const shots = [...el.querySelectorAll('.shot')];
    expect(shots.every((s) => !s.classList.contains('is-visible'))).toBe(true);

    revealer.callback([{ isIntersecting: true, target: shots[1] } as unknown as IntersectionObserverEntry], {} as IntersectionObserver);
    expect(shots.map((s) => s.classList.contains('is-visible'))).toEqual([false, true]);
  });
});
