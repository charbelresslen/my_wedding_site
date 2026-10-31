import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { ASSET_FINGERPRINTS } from './shared/asset-manifest';
import { IMAGE_FINGERPRINTS } from './shared/safe-img';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // provideHttpClient: the RSVP form's only user of the network (src/app/rsvp/rsvp.ts), talking to the local API in server/.
    provideHttpClient(),
    // every picture is checked against its build-time checksum before it is shown (src/app/shared/safe-img.ts)
    { provide: IMAGE_FINGERPRINTS, useValue: ASSET_FINGERPRINTS },
  ],
};
