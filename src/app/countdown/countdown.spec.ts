import { TestBed } from '@angular/core/testing';
import { CELEBRATION, Countdown, plural, splitRemaining } from './countdown';

const SECOND = 1000;
/** the given time before the celebration, in milliseconds */
const before = (days: number, hours = 0, minutes = 0, seconds = 0) =>
  (((days * 24 + hours) * 60 + minutes) * 60 + seconds) * SECOND;

describe('splitRemaining', () => {
  it('splits a span into days, hours, minutes and seconds', () => {
    expect(splitRemaining(before(3, 3, 1, 40))).toEqual({ days: 3, hours: 3, minutes: 1, seconds: 40 });
    expect(splitRemaining(before(116, 1, 22, 35))).toEqual({ days: 116, hours: 1, minutes: 22, seconds: 35 });
  });

  it('counts a started second as a whole one, and never goes below zero', () => {
    expect(splitRemaining(1)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 1 });
    expect(splitRemaining(1000)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 1 });
    expect(splitRemaining(1001).seconds).toBe(2);
    expect(splitRemaining(0)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
    expect(splitRemaining(-5000)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  });
});

describe('plural', () => {
  const days = ['день', 'дня', 'дней'] as const;

  it('picks the right Russian form', () => {
    const forms = (numbers: number[]) => numbers.map((n) => plural(n, days));
    expect(forms([1, 21, 31, 101])).toEqual(['день', 'день', 'день', 'день']);
    expect(forms([2, 3, 4, 22, 24, 102])).toEqual(['дня', 'дня', 'дня', 'дня', 'дня', 'дня']);
    expect(forms([0, 5, 9, 10, 20, 25, 100])).toEqual(['дней', 'дней', 'дней', 'дней', 'дней', 'дней', 'дней']);
    expect(forms([11, 12, 13, 14, 111, 112, 114])).toEqual(['дней', 'дней', 'дней', 'дней', 'дней', 'дней', 'дней']);
  });
});

describe('Countdown', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  /** Puts the clock at `left` before the celebration and shows the component. */
  function create(left: number) {
    vi.useFakeTimers();
    vi.setSystemTime(CELEBRATION.getTime() - left);
    const fixture = TestBed.createComponent(Countdown);
    fixture.detectChanges();
    return fixture;
  }

  const digits = (el: HTMLElement) =>
    [...el.querySelectorAll('.unit')].map((unit) =>
      [...unit.querySelectorAll('.cell')]
        .map((cell) => cell.querySelector('.glyph:not(.leave)')?.textContent?.trim() ?? '')
        .join(''),
    );
  const labels = (el: HTMLElement) => [...el.querySelectorAll('.label')].map((l) => l.textContent?.trim());
  const secondsCells = (el: HTMLElement) => [...el.querySelectorAll('.unit')][3].querySelectorAll('.cell');

  it('shows days, hours, minutes and seconds left, each with its proper Russian label', () => {
    const fixture = create(before(3, 3, 1, 40));
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector('h2')?.textContent).toContain('До начала торжества');
    expect(digits(el)).toEqual(['03', '03', '01', '40']);
    expect(labels(el)).toEqual(['дня', 'часа', 'минута', 'секунд']);
    expect(el.querySelectorAll('.colon').length).toBe(3);
  });

  it('shows the digits of three-figure day counts too', () => {
    const el: HTMLElement = create(before(116, 1, 22, 35)).nativeElement;
    expect(digits(el)).toEqual(['116', '01', '22', '35']);
    expect(labels(el)[0]).toBe('дней');
  });

  it('rolls only the digits that change: the old one out, the new one in', () => {
    const fixture = create(before(3, 3, 1, 40));
    const el: HTMLElement = fixture.nativeElement;

    // 40 -> 39: both seconds digits change
    vi.advanceTimersByTime(1005);
    fixture.detectChanges();
    expect(digits(el)).toEqual(['03', '03', '01', '39']);
    const [tens, ones] = [...secondsCells(el)];
    expect([...tens.querySelectorAll('.glyph')].map((g) => g.textContent?.trim())).toEqual(['4', '3']);
    expect(tens.querySelector('.glyph.leave')?.textContent?.trim()).toBe('4');
    expect(tens.querySelector('.glyph.enter')?.textContent?.trim()).toBe('3');
    expect(ones.querySelector('.glyph.leave')?.textContent?.trim()).toBe('0');
    expect(ones.querySelector('.glyph.enter')?.textContent?.trim()).toBe('9');

    // 39 -> 38: only the last digit; the tens digit stays as it was (still one settled glyph pair)
    vi.advanceTimersByTime(1000);
    fixture.detectChanges();
    expect(digits(el)).toEqual(['03', '03', '01', '38']);
    const [tensAgain, onesAgain] = [...secondsCells(el)];
    expect(tensAgain.querySelector('.glyph.enter')?.textContent?.trim()).toBe('3');
    expect(onesAgain.querySelector('.glyph.leave')?.textContent?.trim()).toBe('9');
    expect(onesAgain.querySelector('.glyph.enter')?.textContent?.trim()).toBe('8');
    // the glyph that rolled out one second ago is gone: never more than two glyphs in a cell
    expect(onesAgain.querySelectorAll('.glyph').length).toBe(2);
  });

  it('rolls the minutes over when the seconds pass zero', () => {
    const fixture = create(before(3, 3, 1, 1));
    const el: HTMLElement = fixture.nativeElement;
    expect(digits(el)).toEqual(['03', '03', '01', '01']);

    vi.advanceTimersByTime(1005);
    fixture.detectChanges();
    expect(digits(el)).toEqual(['03', '03', '01', '00']);

    vi.advanceTimersByTime(1000);
    fixture.detectChanges();
    expect(digits(el)).toEqual(['03', '03', '00', '59']);
    expect(labels(el)).toEqual(['дня', 'часа', 'минут', 'секунд']);
  });

  it('draws the digits again, without rolling, when the number of digits changes (100 days -> 99 days)', () => {
    const fixture = create(before(100));
    const el: HTMLElement = fixture.nativeElement;
    const daysUnit = () => [...el.querySelectorAll('.unit')][0];
    expect(digits(el)[0]).toBe('100');
    expect(daysUnit().querySelectorAll('.cell').length).toBe(3);

    vi.advanceTimersByTime(1005); // 99 days, 23 h, 59 min, 59 s
    fixture.detectChanges();
    expect(digits(el)).toEqual(['99', '23', '59', '59']);
    expect(daysUnit().querySelectorAll('.cell').length).toBe(2);
    expect(daysUnit().querySelectorAll('.glyph.leave, .glyph.enter').length).toBe(0);
  });

  it('is a timer for screen readers that names the time left but not the ticking seconds', () => {
    const fixture = create(before(3, 3, 1, 40));
    const el: HTMLElement = fixture.nativeElement;
    const clock = el.querySelector('.clock') as HTMLElement;

    expect(clock.getAttribute('role')).toBe('timer');
    expect(clock.getAttribute('aria-label')).toBe('До начала торжества: 3 дня, 3 часа, 1 минута');
    for (const digitsRow of el.querySelectorAll('.digits')) expect(digitsRow.getAttribute('aria-hidden')).toBe('true');

    vi.advanceTimersByTime(1005);
    fixture.detectChanges();
    expect(clock.getAttribute('aria-label')).toBe('До начала торжества: 3 дня, 3 часа, 1 минута');
  });

  it('says so when the celebration has begun, shows zeros and stops ticking', () => {
    const fixture = create(-5000);
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector('h2')?.textContent).toContain('Торжество началось');
    expect(digits(el)).toEqual(['00', '00', '00', '00']);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reaches zero at the very moment the celebration begins', () => {
    const fixture = create(2 * SECOND);
    const el: HTMLElement = fixture.nativeElement;
    expect(digits(el)[3]).toBe('02');

    vi.advanceTimersByTime(1005);
    fixture.detectChanges();
    expect(digits(el)[3]).toBe('01');
    expect(el.querySelector('h2')?.textContent).toContain('До начала');

    vi.advanceTimersByTime(1000);
    fixture.detectChanges();
    expect(digits(el)[3]).toBe('00');
    expect(el.querySelector('h2')?.textContent).toContain('Торжество началось');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('pauses while the tab is hidden and catches up at once when it is shown again', () => {
    const fixture = create(before(3, 3, 1, 40));
    const el: HTMLElement = fixture.nativeElement;
    let hidden = true;
    vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);

    document.dispatchEvent(new Event('visibilitychange'));
    expect(vi.getTimerCount()).toBe(0);

    // two minutes pass while nobody looks
    vi.advanceTimersByTime(120 * SECOND);
    fixture.detectChanges();
    expect(digits(el)).toEqual(['03', '03', '01', '40']);

    hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    fixture.detectChanges();
    expect(digits(el)).toEqual(['03', '02', '59', '40']); // the two minutes went by
    expect(vi.getTimerCount()).toBe(1);
  });

  it('stops its timer when it is destroyed', () => {
    const fixture = create(before(3, 3, 1, 40));
    expect(vi.getTimerCount()).toBe(1);
    fixture.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });
});
