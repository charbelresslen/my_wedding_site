import { ChangeDetectionStrategy, Component } from '@angular/core';
import { revealOnView } from '../shared/reveal-on-view';
import { SafeImg } from '../shared/safe-img';

/**
 * Step 9: "Пожелания". A card written on the wall of the wedding hall, with a burgundy flower cluster on the
 * top-left and one on the bottom-right corner: the couple's wishes to their guests, in their own words - a gift as a
 * contribution to the young family, lottery tickets instead of bouquets, and whom to tell about a creative toast.
 * The wording is in `gift.html`.
 */
@Component({
  selector: 'app-gift',
  imports: [SafeImg],
  templateUrl: './gift.html',
  styleUrl: './gift.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.is-visible]': 'visible()' },
})
export class GiftSection {
  /** True once the section has scrolled into view (starts its entrance). */
  protected readonly visible = revealOnView(0.2);
}
