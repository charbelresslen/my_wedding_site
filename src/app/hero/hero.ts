import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Step 2: the welcome. The couple's photo at full width, the names in calligraphy, flowers at the
 * corners of the writing. Everything is visible from the start (so the intro video can dissolve straight into it);
 * once `revealed` turns true the writing and flowers animate in.
 */
@Component({
  selector: 'app-hero',
  templateUrl: './hero.html',
  styleUrl: './hero.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.is-revealed]': 'revealed()' },
})
export class Hero {
  /** True once the intro video has gone: starts the entrance animation. */
  readonly revealed = input(false);
}
