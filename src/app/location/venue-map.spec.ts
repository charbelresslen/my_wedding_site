import { TestBed } from '@angular/core/testing';
import { VenueMap } from './venue-map';

const PREVIEW = 'https://static-maps.yandex.ru/1.x/?lang=ru_RU&ll=60.612029,56.836194&z=17&l=map&size=615,450&scale=1.5&pt=60.612029,56.836194,pm2rdl';
const WIDGET = 'https://yandex.ru/map-widget/v1/?ll=60.612029%2C56.836194&z=17&pt=60.612029,56.836194,pm2rdl&lang=ru_RU';
const LINK = 'https://yandex.ru/maps/org/example/1/?ll=60.612029%2C56.836194&z=17';

describe('VenueMap', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function create() {
    const fixture = TestBed.createComponent(VenueMap);
    fixture.componentRef.setInput('preview', PREVIEW);
    fixture.componentRef.setInput('widget', WIDGET);
    fixture.componentRef.setInput('link', LINK);
    fixture.componentRef.setInput('mapTitle', 'Карта: Дворец бракосочетания');
    fixture.componentRef.setInput('buttonLabel', 'Открыть в Яндекс Картах: Дворец бракосочетания');
    fixture.detectChanges();
    return fixture;
  }

  const query = <T extends Element>(fixture: { nativeElement: HTMLElement }, selector: string) => fixture.nativeElement.querySelector<T>(selector);

  it('draws the frame with the ornament on its top and bottom edge, and the button under it', () => {
    const el: HTMLElement = create().nativeElement;

    expect(el.querySelector('.box')).not.toBeNull();
    expect([...el.querySelectorAll('.orn')].map((o) => o.getAttribute('src'))).toEqual(['media/loc-ornament.webp', 'media/loc-ornament.webp']);
    for (const orn of el.querySelectorAll('.orn')) expect(orn.getAttribute('aria-hidden')).toBe('true');
    const button = el.querySelector<HTMLAnchorElement>('a.button')!;
    expect(button.href).toBe(LINK);
    expect(button.target).toBe('_blank');
    expect(button.rel).toContain('noopener');
    expect(button.textContent?.trim()).toBe('Открыть в Яндекс Картах');
  });

  it('shows the map as a picture straight away, with nothing heavy loaded (no movable map yet)', () => {
    const fixture = create();
    const picture = query<HTMLImageElement>(fixture, '.preview')!;

    expect(picture.getAttribute('src')).toBe(PREVIEW);
    expect(picture.alt).toBe('Карта: Дворец бракосочетания');
    expect(query(fixture, 'iframe')).toBeNull();
    expect(query(fixture, '.shield')?.classList.contains('is-off')).toBe(false);
    expect(query(fixture, '.box')?.classList.contains('is-loading')).toBe(false);
  });

  it('loads the movable map only when the map is tapped, and takes the cover off', () => {
    const fixture = create();
    (query(fixture, '.shield') as HTMLElement).click();
    fixture.detectChanges();

    const frame = query<HTMLIFrameElement>(fixture, 'iframe')!;
    expect(frame.getAttribute('src')).toBe(WIDGET);
    expect(frame.getAttribute('title')).toBe('Карта: Дворец бракосочетания');
    expect(query(fixture, '.shield')?.classList.contains('is-off')).toBe(true);
  });

  it('keeps the movable map hidden while it draws (a spinner shows), then fades it in over the picture', () => {
    vi.useFakeTimers();
    const fixture = create();
    (query(fixture, '.shield') as HTMLElement).click();
    fixture.detectChanges();
    const frame = query<HTMLIFrameElement>(fixture, 'iframe')!;
    const box = query(fixture, '.box')!;

    expect(frame.classList.contains('is-shown')).toBe(false);
    expect(box.classList.contains('is-loading')).toBe(true);

    frame.dispatchEvent(new Event('load'));
    vi.advanceTimersByTime(4000);
    fixture.detectChanges();
    expect(frame.classList.contains('is-shown')).toBe(false);
    expect(box.classList.contains('is-loading')).toBe(true);

    vi.advanceTimersByTime(600);
    fixture.detectChanges();
    expect(frame.classList.contains('is-shown')).toBe(true);
    expect(box.classList.contains('is-loading')).toBe(false);
    // the picture stays underneath
    expect(query(fixture, '.preview')).not.toBeNull();
  });

  it('puts the cover back when the guest taps elsewhere, and keeps the map that was loaded', () => {
    const fixture = create();
    const el: HTMLElement = fixture.nativeElement;
    const shield = query(fixture, '.shield') as HTMLElement;
    shield.click();
    fixture.detectChanges();

    // a tap inside the component keeps the map movable
    el.querySelector('.button')!.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    fixture.detectChanges();
    expect(shield.classList.contains('is-off')).toBe(true);

    // a tap anywhere else puts the cover back
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    fixture.detectChanges();
    expect(shield.classList.contains('is-off')).toBe(false);
    expect(query(fixture, 'iframe')).not.toBeNull();

    // and the next tap makes it movable again without loading a second frame
    shield.click();
    fixture.detectChanges();
    expect(shield.classList.contains('is-off')).toBe(true);
    expect(fixture.nativeElement.querySelectorAll('iframe').length).toBe(1);
  });

  it('loads the movable map at once if the picture cannot be loaded, with the spinner until its page has loaded, then shows it', () => {
    const fixture = create();
    (query(fixture, '.preview') as HTMLImageElement).dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(query(fixture, '.preview')).toBeNull();
    expect(query(fixture, '.pin')?.getAttribute('aria-hidden')).toBe('true');
    const frame = query<HTMLIFrameElement>(fixture, 'iframe')!;
    expect(frame.getAttribute('src')).toBe(WIDGET);
    expect(frame.classList.contains('is-shown')).toBe(false);
    expect(query(fixture, '.box')?.classList.contains('is-loading')).toBe(true);

    frame.dispatchEvent(new Event('load'));
    fixture.detectChanges();
    expect(frame.classList.contains('is-shown')).toBe(true);
    expect(query(fixture, '.box')?.classList.contains('is-loading')).toBe(false);
  });

  it('can be reached by keyboard: the cover is a real button, and it leaves the tab order once the map is live', () => {
    const fixture = create();
    const shield = query<HTMLButtonElement>(fixture, '.shield')!;

    expect(shield.tagName).toBe('BUTTON');
    expect(shield.getAttribute('aria-label')).toBe('Двигать и приближать карту');
    expect(shield.getAttribute('tabindex')).toBe('0');

    shield.click();
    fixture.detectChanges();
    expect(shield.getAttribute('tabindex')).toBe('-1');
  });

  it('stops its timer and its listener when it is destroyed', () => {
    vi.useFakeTimers();
    const removed = vi.spyOn(document, 'removeEventListener');
    const cleared = vi.spyOn(globalThis, 'clearTimeout');
    const fixture = create();
    (query(fixture, '.shield') as HTMLElement).click();
    fixture.detectChanges();
    query<HTMLIFrameElement>(fixture, 'iframe')!.dispatchEvent(new Event('load'));
    cleared.mockClear();

    fixture.destroy();
    expect(removed).toHaveBeenCalledWith('pointerdown', expect.any(Function), true);
    expect(cleared).toHaveBeenCalled();
    expect(() => vi.advanceTimersByTime(10_000)).not.toThrow();
  });
});
