import { ChangeDetectionStrategy, Component } from '@angular/core';
import { revealOnView } from '../shared/reveal-on-view';

/**
 * Step 11: the very last thing a guest sees - a quiet closing line and, underneath it, "Сделано с любовью" (made with
 * love), with no name or brand on it, like the card the user asked for. Nothing to read or do here, so it plays its
 * entrance as one piece rather than part by part.
 */
@Component({
  selector: 'app-closing',
  templateUrl: './closing.html',
  styleUrl: './closing.css',
  host: { '[class.is-visible]': 'visible()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Closing {
  protected readonly visible = revealOnView(0.4);
}
