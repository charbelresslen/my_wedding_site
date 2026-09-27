import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Rsvp } from './rsvp';

const MENU = {
  drinkOptions: [
    { id: 1, name: 'Сухое шампанское' },
    { id: 13, name: 'Я не пью алкоголь' },
  ],
  foodCategories: [
    {
      id: 1,
      name: 'Аперитив',
      items: [
        { id: 101, name: 'Креветка со свежим огурцом' },
        { id: 104, name: 'Виноград с сыром' },
      ],
    },
    {
      id: 4,
      name: 'Салаты',
      items: [{ id: 401, name: 'Салат с ростбифом и печёным перцем' }],
    },
  ],
};

describe('Rsvp', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function create() {
    const fixture = TestBed.createComponent(Rsvp);
    fixture.detectChanges();
    return fixture;
  }

  const say = (el: Element | null) => el?.textContent?.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

  function open(el: HTMLElement) {
    (el.querySelector('.cta') as HTMLButtonElement).click();
  }

  function fillName(el: HTMLElement, fixture: ReturnType<typeof create>, name: string) {
    const input = el.querySelector('.text-input') as HTMLInputElement;
    input.value = name;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function choose(el: HTMLElement, fixture: ReturnType<typeof create>, selector: string) {
    (el.querySelector(selector) as HTMLInputElement).click();
    fixture.detectChanges();
  }

  /** the two attendance radios share `name="attendance"`, each alone in its own `<label>`, so `:first-of-type` /
   *  `:last-of-type` would match both of them (each is the only input in its own parent) - index instead. */
  function chooseAttendance(el: HTMLElement, fixture: ReturnType<typeof create>, which: 'both' | 'zagsOnly') {
    const radios = [...el.querySelectorAll<HTMLInputElement>('input[name="attendance"]')];
    radios[which === 'both' ? 0 : 1].click();
    fixture.detectChanges();
  }

  it('shows the title and the 30 November 2026 deadline, with the dialog closed', () => {
    const el: HTMLElement = create().nativeElement;
    expect(say(el.querySelector('#rsvp-title'))).toBe('Подтверждение');
    expect(say(el.querySelector('.lead'))).toContain('30 ноября 2026');
    expect(el.querySelector('[role="dialog"]')).toBeNull();
  });

  it('opens the dialog, fetches the menu and renders its drinks and food categories', () => {
    const fixture = create();
    const el: HTMLElement = fixture.nativeElement;
    open(el);
    fixture.detectChanges();

    expect(el.querySelector('[role="dialog"]')).toBeTruthy();
    chooseAttendance(el, fixture, 'both'); // the drink and food fields only matter once the guest is coming to the banquet
    http.expectOne('http://localhost:3010/api/menu').flush(MENU);
    fixture.detectChanges();

    expect(say(el.querySelector('.choices.drinks'))).toContain('Сухое шампанское');
    expect(say(el.querySelector('.choices.drinks'))).toContain('Я не пью алкоголь');
    const legends = [...el.querySelectorAll('.field-label')].map(say);
    expect(legends).toContain('Аперитив');
    expect(legends).toContain('Салаты');
  });

  it('does not need a drink or a dish when the guest comes only to the ZAGS ceremony', () => {
    const fixture = create();
    const el: HTMLElement = fixture.nativeElement;
    open(el);
    fixture.detectChanges();
    http.expectOne('http://localhost:3010/api/menu').flush(MENU);
    fixture.detectChanges();

    fillName(el, fixture, 'Иван Иванов');
    chooseAttendance(el, fixture, 'zagsOnly');

    expect(el.querySelector('.drinks')).toBeNull();
    const submit = el.querySelector('.submit') as HTMLButtonElement;
    expect(submit.disabled).toBe(false);
  });

  it('requires a drink and one dish per category before the banquet guest can submit', () => {
    const fixture = create();
    const el: HTMLElement = fixture.nativeElement;
    open(el);
    fixture.detectChanges();
    http.expectOne('http://localhost:3010/api/menu').flush(MENU);
    fixture.detectChanges();

    fillName(el, fixture, 'Анна Петрова');
    chooseAttendance(el, fixture, 'both');
    const submit = () => el.querySelector('.submit') as HTMLButtonElement;
    expect(submit().disabled).toBe(true);

    choose(el, fixture, 'input[name="drink"]');
    expect(submit().disabled).toBe(true);

    choose(el, fixture, 'input[name="food-1"]');
    expect(submit().disabled).toBe(true); // "Салаты" still unpicked

    choose(el, fixture, 'input[name="food-4"]');
    expect(submit().disabled).toBe(false);
  });

  it('posts the full name, attendance, drink and one dish per category, then thanks the guest by name', () => {
    const fixture = create();
    const el: HTMLElement = fixture.nativeElement;
    open(el);
    fixture.detectChanges();
    http.expectOne('http://localhost:3010/api/menu').flush(MENU);
    fixture.detectChanges();

    fillName(el, fixture, 'Анна Петрова');
    chooseAttendance(el, fixture, 'both');
    choose(el, fixture, 'input[name="drink"]');
    choose(el, fixture, 'input[name="food-1"]');
    choose(el, fixture, 'input[name="food-4"]');
    (el.querySelector('.submit') as HTMLButtonElement).click();
    fixture.detectChanges();

    const req = http.expectOne('http://localhost:3010/api/rsvp');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      fullName: 'Анна Петрова',
      attendance: 'both',
      drinkOptionId: 1,
      foodChoices: { 1: 101, 4: 401 },
    });
    req.flush({ id: 42 }, { status: 201, statusText: 'Created' });
    fixture.detectChanges();

    expect(say(el.querySelector('.done-text'))).toBe('Спасибо, Анна Петрова! Мы очень ждём встречи с вами.');
  });

  it('shows a friendly Russian message, in Russian, when the server refuses the answer', () => {
    const fixture = create();
    const el: HTMLElement = fixture.nativeElement;
    open(el);
    fixture.detectChanges();
    http.expectOne('http://localhost:3010/api/menu').flush(MENU);
    fixture.detectChanges();

    fillName(el, fixture, 'Пётр');
    chooseAttendance(el, fixture, 'zagsOnly');
    (el.querySelector('.submit') as HTMLButtonElement).click();
    fixture.detectChanges();

    http.expectOne('http://localhost:3010/api/rsvp').flush({ error: 'MISSING_NAME' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();

    expect(say(el.querySelector('.hint.error'))).toBe('Пожалуйста, напишите ваше имя и фамилию.');
    expect(el.querySelector('.done')).toBeNull();
  });

  it('offers to try again if the menu fails to load', () => {
    const fixture = create();
    const el: HTMLElement = fixture.nativeElement;
    open(el);
    fixture.detectChanges();
    chooseAttendance(el, fixture, 'both');
    http.expectOne('http://localhost:3010/api/menu').error(new ProgressEvent('network error'));
    fixture.detectChanges();

    expect(say(el.querySelector('.hint.error'))).toContain('Не удалось загрузить меню');
    (el.querySelector('.retry') as HTMLButtonElement).click();
    fixture.detectChanges();
    http.expectOne('http://localhost:3010/api/menu').flush(MENU);
    fixture.detectChanges();

    expect(el.querySelector('.hint.error')).toBeNull();
    expect(say(el.querySelector('.choices.drinks'))).toContain('Сухое шампанское');
  });

  it('closes on Escape and gives focus back to the RSVP button', () => {
    const fixture = create();
    const el: HTMLElement = fixture.nativeElement;
    const trigger = el.querySelector('.cta') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();
    http.expectOne('http://localhost:3010/api/menu').flush(MENU);
    fixture.detectChanges();

    const dialog = el.querySelector('[role="dialog"]') as HTMLElement;
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(el.querySelector('[role="dialog"]')).toBeNull();
    expect(el.ownerDocument.activeElement).toBe(trigger);
  });

  it('shows the title, divider, sentence and button at once where IntersectionObserver is missing', () => {
    const el: HTMLElement = create().nativeElement;
    const parts = [...el.querySelectorAll('[data-reveal]')];
    expect(parts.length).toBe(4); // the title, the divider, the sentence and the RSVP button
    for (const part of parts) expect(part.classList.contains('is-visible')).toBe(true);
  });

  it('is a labelled section headed by its title', () => {
    const el: HTMLElement = create().nativeElement;
    const heading = el.querySelector('#rsvp-title') as HTMLElement;
    expect(el.querySelector('section')?.getAttribute('aria-labelledby')).toBe(heading.id);
  });
});
