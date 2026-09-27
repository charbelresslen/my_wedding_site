import { ChangeDetectionStrategy, Component } from '@angular/core';
import { revealOnView } from '../shared/reveal-on-view';

/**
 * Step 4: the invitation itself, written on the wall of the ZAGS hall, with peonies in the two bottom corners.
 * The wording is in `invitation.html`. (Parents' names, the place and the time are not on it yet.)
 */
@Component({
  selector: 'app-invitation',
  templateUrl: './invitation.html',
  styleUrl: './invitation.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.is-visible]': 'visible()' },
})
export class Invitation {
  /** True once the section has scrolled into view (starts its entrance). */
  protected readonly visible = revealOnView(0.2);
}
