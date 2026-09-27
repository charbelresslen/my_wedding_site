import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, inject, input, signal } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

/**
 * How long the movable map is given to draw its tiles after its page has loaded, before it fades in over the picture.
 * (Yandex's map is a heavy page: its frame sits as an empty dotted grid until its tiles arrive, and nothing outside the
 * frame can tell when that is, so the picture stays in front, with a spinner, for this long.)
 */
const TILES_MS = 4500;

/**
 * A map in a burgundy frame with the ornament on its top and bottom edge, and a button under it that opens the place in
 * Yandex Maps. Only the addresses in `location.ts` are ever put into the iframe.
 *
 * The map is first a Yandex Static Maps picture: one small image, there at once, never a blank grid. Tapping it (the
 * round "move" mark in the corner) loads the movable Yandex map behind the picture; a spinner shows while it loads, and
 * the map fades in over the picture once it has had time to draw. Until then, and whenever the guest has not tapped, a
 * transparent cover lies over the map, so a swipe over it scrolls the page instead of dragging the map; a tap anywhere
 * outside the map puts the cover back. If the picture cannot be loaded, the movable map is loaded instead, at once.
 */
@Component({
  selector: 'app-venue-map',
  templateUrl: './venue-map.html',
  styleUrl: './venue-map.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VenueMap {
  /** The picture of the map (static-maps.yandex.ru), 615x450 with the pin in the middle. */
  readonly preview = input.required<string>();
  /** The movable map (yandex.ru/map-widget). */
  readonly widget = input.required<string>();
  /** Where the button leads (the place on yandex.ru/maps). */
  readonly link = input.required<string>();
  /** What screen readers call the map, e.g. "Карта: Дворец бракосочетания". */
  readonly mapTitle = input.required<string>();
  /** What screen readers call the button. */
  readonly buttonLabel = input.required<string>();

  /** True if the picture could not be loaded. */
  protected readonly previewFailed = signal(false);
  /** True once the movable map has been asked for (its frame exists). */
  protected readonly live = signal(false);
  /** True once it has had time to draw: it is then faded in over the picture. */
  protected readonly shown = signal(false);
  /** True after the guest has tapped the map: the cover is off and the map can be moved. */
  protected readonly engaged = signal(false);
  /** True while the map the guest asked for is still drawing (the spinner shows). */
  protected readonly loading = computed(() => this.live() && !this.shown());
  protected readonly frameSrc = computed(() => (this.live() ? this.sanitizer.bypassSecurityTrustResourceUrl(this.widget()) : null));

  private readonly sanitizer = inject(DomSanitizer);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private showTimer: ReturnType<typeof setTimeout> | undefined;

  private readonly tappedElsewhere = (event: Event) => {
    if (!this.host.nativeElement.contains(event.target as Node)) this.release();
  };

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.showTimer);
      document.removeEventListener('pointerdown', this.tappedElsewhere, true);
    });
  }

  /** The guest taps the map: the movable one is loaded (once) and the cover comes off. */
  protected activate(): void {
    if (this.engaged()) return;
    this.engaged.set(true);
    this.live.set(true);
    document.addEventListener('pointerdown', this.tappedElsewhere, true);
  }

  /** No picture to wait behind: load the movable map at once (the spinner shows until its page has loaded). */
  protected onPreviewError(): void {
    this.previewFailed.set(true);
    this.live.set(true);
  }

  /** The page of the movable map has loaded; its tiles arrive a little later. */
  protected onFrameLoad(): void {
    if (this.shown()) return;
    clearTimeout(this.showTimer);
    if (this.previewFailed()) this.shown.set(true);
    else this.showTimer = setTimeout(() => this.shown.set(true), TILES_MS);
  }

  /** A tap somewhere else: the cover goes back on, so a swipe over the map scrolls the page again. */
  private release(): void {
    this.engaged.set(false);
    document.removeEventListener('pointerdown', this.tappedElsewhere, true);
  }
}
