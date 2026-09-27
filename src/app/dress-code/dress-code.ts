import { ChangeDetectionStrategy, Component } from '@angular/core';
import { revealParts } from '../shared/reveal-on-view';

interface Shade {
  name: string;
  /** the colour of the circle */
  color: string;
}

/**
 * The palette. The first four are the user's own circles (their colours were read from the picture they sent); black
 * and the colour of the page itself (`--bg` in styles.css) were added at their request. Change colours and names here.
 */
const SHADES: Shade[] = [
  { name: 'Бордо', color: '#540f08' },
  { name: 'Шоколад', color: '#321b0d' },
  { name: 'Мокко', color: '#8d6752' },
  { name: 'Пудровый', color: '#cf9f9d' },
  { name: 'Чёрный', color: '#161312' },
  { name: 'Молочный', color: '#fdf4eb' },
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
