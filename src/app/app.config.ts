import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { ASSET_FINGERPRINTS } from './shared/asset-manifest';
import { MEDIA_FINGERPRINTS } from './shared/media-loader';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // provideHttpClient: the RSVP form's only user of the network (src/app/rsvp/rsvp.ts), talking to the local API in server/.
    provideHttpClient(),
    // every picture and the video are checked against their build-time checksums before use (src/app/shared/media-loader.ts)
    { provide: MEDIA_FINGERPRINTS, useValue: ASSET_FINGERPRINTS },
  ],
};
