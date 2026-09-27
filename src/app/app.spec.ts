import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the welcome section with the intro video on top of it', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('app-home app-hero')).toBeTruthy();
    expect(root.querySelector('app-intro-video video')).toBeTruthy();
  });

  it('writes the names in Russian', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const heading = (fixture.nativeElement as HTMLElement).querySelector('h1')?.textContent ?? '';

    expect(heading).toContain('Шарбель');
    expect(heading).toContain('Анна');
  });
});
