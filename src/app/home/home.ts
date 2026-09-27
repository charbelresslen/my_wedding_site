import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Closing } from '../closing/closing';
import { Countdown } from '../countdown/countdown';
import { Couple } from '../couple/couple';
import { DateSection } from '../date-section/date-section';
import { DressCode } from '../dress-code/dress-code';
import { GiftSection } from '../gift/gift';
import { Hero } from '../hero/hero';
import { Invitation } from '../invitation/invitation';
import { LocationSection } from '../location/location';
import { Rsvp } from '../rsvp/rsvp';
import { Timeline } from '../timeline/timeline';

/** The site's main page: the sections, one below the other. */
@Component({
  selector: 'app-home',
  imports: [Hero, DateSection, Invitation, Couple, Timeline, Countdown, LocationSection, DressCode, GiftSection, Rsvp, Closing],
  template: `
    <app-hero [revealed]="revealed()" />
    <app-date-section />
    <app-invitation />
    <app-couple />
    <app-timeline />
    <app-countdown />
    <app-location />
    <app-dress-code />
    <app-gift />
    <app-rsvp />
    <app-closing />
  `,
  styles: `
    :host {
      display: block;
      min-height: 100vh;
      background: var(--bg);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  /** True once the intro video has gone (starts the entrance animations). */
  readonly revealed = input(false);
}
