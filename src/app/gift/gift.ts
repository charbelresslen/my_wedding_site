import { ChangeDetectionStrategy, Component } from '@angular/core';
import { revealOnView } from '../shared/reveal-on-view';

/**
 * Step 9: "О подарках". A card written on the wall of the wedding hall: what matters most to the couple, a warm word
 * about a gift in an envelope, and a light joke about bouquets and lottery tickets, with a burgundy flower cluster on
 * the top-left and one on the bottom-right corner. The wording is in `gift.html`.
 */
@Component({
  selector: 'app-gift',
  templateUrl: './gift.html',
  styleUrl: './gift.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.is-visible]': 'visible()' },
})
export class GiftSection {
  /** True once the section has scrolled into view (starts its entrance). */
  protected readonly visible = revealOnView(0.2);
}
