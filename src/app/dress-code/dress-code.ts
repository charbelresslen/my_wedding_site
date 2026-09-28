import { ChangeDetectionStrategy, Component } from '@angular/core';
import { revealParts } from '../shared/reveal-on-view';

interface Shade {
  name: string;
  /** the colour of the circle */
  color: string;
}

/**
 * The palette. The first four are the user's own circles (their colours were read from the picture they sent); black
 * and cream were added at their request. Cream (`#e8cbb1`) is sampled directly from the last woman's actual dress in
 * source-people.webp (see the bottom of tools/dresscode-assets/make_assets.py) - it is NOT recoloured to match this
 * swatch (an earlier version did that backwards: picked a colour first, then multiply-blended the real photo towards
 * it, which just made the dress in the picture look like a different, wrong colour from the swatch next to it). If
 * source-people.webp is ever replaced, re-run make_assets.py and paste its printed "cream swatch colour" in here.
 * Site tokens (--bg/--paper) were tried first too and both read as pale grey once rendered this small. Change
 * colours and names here.
 */
const SHADES: Shade[] = [
  { name: 'Бордо', color: '#540f08' },
  { name: 'Шоколад', color: '#321b0d' },
  { name: 'Мокко', color: '#8d6752' },
  { name: 'Пудровый', color: '#cf9f9d' },
  { name: 'Чёрный', color: '#161312' },
  { name: 'Кремовый', color: '#e8cbb1' },
];

/**
 * Step 8: "Дресс-код". The guests dressed in the palette, the invitation to wear these shades, and the shades as
 * circles drawn in CSS (a soft light on each, a hairline ring so the cream one is visible on the cream page).
 */
@Component({
  selector: 'app-dress-code',
  templateUrl: './dress-code.html',
  styleUrl: './dress-code.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DressCode {
  protected readonly shades = SHADES;

  constructor() {
    // the heading, the figures, the sentence and the palette play their entrance one by one as they scroll into view
    revealParts(0.3);
  }
}
