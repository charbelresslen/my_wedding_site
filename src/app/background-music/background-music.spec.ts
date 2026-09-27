import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BackgroundMusic } from './background-music';

/** A tiny host so `playing` (an input) can be changed after creation, the way `app.html` changes it. */
@Component({
  selector: 'app-host',
  imports: [BackgroundMusic],
  template: `<app-background-music [playing]="playing()" />`,
})
class Host {
  readonly playing = signal(false);
}

describe('BackgroundMusic', () => {
  const KEY = 'wedding-music-muted';

  beforeEach(() => localStorage.removeItem(KEY));
  afterEach(() => localStorage.removeItem(KEY));

  function create() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    return fixture;
  }

  it('is silent and out of the way before the envelope has opened: no button, but the track is ready to play', () => {
    const fixture = create();
    const el: HTMLElement = fixture.nativeElement;
    const audio = el.querySelector('audio') as HTMLAudioElement;
    expect(audio.getAttribute('src')).toBe('media/background-music.mp3');
    expect(audio.hasAttribute('loop')).toBe(true);
    expect(el.querySelector('.toggle')).toBeNull();
  });

  it('shows the mute button once the envelope opens, and not before', () => {
    const fixture = create();
    fixture.componentInstance.playing.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.toggle')).toBeTruthy();
  });

  it('toggles the audio element\'s muted state and the button\'s label when pressed', () => {
    const fixture = create();
    fixture.componentInstance.playing.set(true);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const audio = el.querySelector('audio') as HTMLAudioElement;
    const button = () => el.querySelector('.toggle') as HTMLButtonElement;

    expect(audio.muted).toBe(false);
    expect(button().getAttribute('aria-label')).toBe('Выключить музыку');
    expect(button().getAttribute('aria-pressed')).toBe('true');

    button().click();
    fixture.detectChanges();
    expect(audio.muted).toBe(true);
    expect(button().getAttribute('aria-label')).toBe('Включить музыку');
    expect(button().getAttribute('aria-pressed')).toBe('false');

    button().click();
    fixture.detectChanges();
    expect(audio.muted).toBe(false);
    expect(button().getAttribute('aria-label')).toBe('Выключить музыку');
  });

  it('turns the sound on with a single click even when the guest\'s first-ever interaction with the page is that very button', async () => {
    // Simulate a browser that refuses autoplay outright (with sound, then even muted) until a real gesture happens -
    // the exact situation where the component arms its page-wide "first gesture unmutes" listener (see intro-video.ts
    // for the same pattern). The button must not also be caught by that listener, or the two would undo each other:
    // one turns the sound on, the other (reading the pre-click state) turns it back off in the same click.
    const real = HTMLMediaElement.prototype.play;
    let calls = 0;
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
      calls++;
      return calls <= 2 ? Promise.reject(new DOMException('blocked', 'NotAllowedError')) : real.call(this);
    });

    const fixture = create();
    fixture.componentInstance.playing.set(true);
    fixture.detectChanges();
    for (let i = 0; i < 10; i++) await Promise.resolve();

    const el: HTMLElement = fixture.nativeElement;
    const audio = el.querySelector('audio') as HTMLAudioElement;
    const button = el.querySelector('.toggle') as HTMLButtonElement;
    expect(calls).toBe(2); // sanity check: both automatic attempts (with sound, then muted) really were made and refused
    expect(audio.muted).toBe(true); // waiting silently for a gesture

    button.click(); // the guest's first and only interaction with the page is this exact button
    fixture.detectChanges();
    await Promise.resolve();

    expect(audio.muted).toBe(false);
    expect(button.getAttribute('aria-label')).toBe('Выключить музыку');

    vi.restoreAllMocks();
  });

  it('remembers a muted choice for next time, and starts muted if it was left that way', () => {
    const fixture = create();
    fixture.componentInstance.playing.set(true);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    (el.querySelector('.toggle') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(localStorage.getItem(KEY)).toBe('true');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const fixture2 = TestBed.createComponent(Host);
    fixture2.componentInstance.playing.set(true);
    fixture2.detectChanges();
    const audio2 = fixture2.nativeElement.querySelector('audio') as HTMLAudioElement;
    expect(audio2.muted).toBe(true);
  });
});
