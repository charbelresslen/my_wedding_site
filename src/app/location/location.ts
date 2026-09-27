import { ChangeDetectionStrategy, Component } from '@angular/core';
import { revealParts } from '../shared/reveal-on-view';
import { VenueMap } from './venue-map';

interface Venue {
  id: string;
  /** what happens there */
  role: string;
  city: string;
  name: string;
  address: string;
  photo: { src: string; width: number; height: number; alt: string };
  /** the picture of the map, with a pin on the exact spot (Yandex Static Maps) */
  preview: string;
  /** the movable map, with a pin on the exact spot (loaded when the guest taps the map) */
  widget: string;
  /** the place in Yandex Maps (the button under the map opens it) */
  link: string;
}

/**
 * The two places. The coordinates are the ones Yandex Maps itself gives for each place (longitude, latitude), and the
 * ZAGS page is the one of the organisation "Управление ЗАГС Свердловской области, Дворец бракосочетания".
 */
const VENUES: Venue[] = [
  {
    id: 'zags',
    role: 'Церемония',
    city: 'Екатеринбург',
    name: 'Дворец бракосочетания',
    address: 'улица Карла Либкнехта, 3',
    photo: {
      src: 'media/loc-zags.webp',
      width: 1200,
      height: 830,
      alt: 'Дворец бракосочетания в Екатеринбурге на закате',
    },
    preview: 'https://static-maps.yandex.ru/1.x/?lang=ru_RU&ll=60.612029,56.836194&z=17&l=map&size=615,450&scale=1.5&pt=60.612029,56.836194,pm2rdl',
    widget: 'https://yandex.ru/map-widget/v1/?ll=60.612029%2C56.836194&z=17&pt=60.612029,56.836194,pm2rdl&lang=ru_RU',
    link: 'https://yandex.ru/maps/org/upravleniye_zags_sverdlovskoy_oblasti_dvorets_brakosochetaniya/125502093405/?ll=60.612029%2C56.836194&z=17',
  },
  {
    id: 'hotel',
    role: 'Банкет',
    city: 'Екатеринбург',
    name: 'Отель «Гранд Авеню»',
    address: 'проспект Ленина, 40',
    photo: {
      src: 'media/loc-hotel.webp',
      width: 1200,
      height: 900,
      alt: 'Отель «Гранд Авеню» вечером, с подсветкой',
    },
    preview: 'https://static-maps.yandex.ru/1.x/?lang=ru_RU&ll=60.612638,56.838967&z=17&l=map&size=615,450&scale=1.5&pt=60.612638,56.838967,pm2rdl',
    widget: 'https://yandex.ru/map-widget/v1/?ll=60.612638%2C56.838967&z=17&pt=60.612638,56.838967,pm2rdl&lang=ru_RU',
    link: 'https://yandex.ru/maps/54/yekaterinburg/house/prospekt_lenina_40/YkkYcAZiT0YPQFtsfXRyeXVlYw==/?ll=60.612638%2C56.838967&z=17',
  },
];

/**
 * Step 7: "Локация". The ceremony and the banquet, one under the other: where and what it is, a photo of the place
 * with a sprig of flowers on its corner, its map (a picture, movable after a tap) in a burgundy frame, and a button
 * that opens it in Yandex Maps.
 * Change addresses, photos and links in `VENUES` above.
 */
@Component({
  selector: 'app-location',
  imports: [VenueMap],
  templateUrl: './location.html',
  styleUrl: './location.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocationSection {
  protected readonly venues = VENUES;

  constructor() {
    // each part (the heading, and for every place its text, photo and map) plays its entrance when it scrolls into view
    revealParts(0.3);
  }
}
