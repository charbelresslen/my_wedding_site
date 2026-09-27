import { ChangeDetectionStrategy, Component } from '@angular/core';
import { revealParts } from '../shared/reveal-on-view';

/**
 * Step 4b: "Наша история" - the couple's own two photos, so guests who do not know them yet get a face to the names.
 * Placed right after the invitation. The photos are shown as they were sent (no crop, no filter, no frame drawn over
 * them - only rounded corners and a shadow), one a little larger and the other overlapping its corner like a second
 * print laid on top, the way a warm, modern site would show a couple's own pictures.
 */
@Component({
  selector: 'app-couple',
  templateUrl: './couple.html',
  styleUrl: './couple.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Couple {
  constructor() {
    // the heading, the sentence and the photos play their entrance as the section scrolls into view
    revealParts(0.25);
  }
}
