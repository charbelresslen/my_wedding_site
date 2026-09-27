import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';

export const appConfig: ApplicationConfig = {
  // provideHttpClient: the RSVP form's only user of the network (src/app/rsvp/rsvp.ts), talking to the local API in server/.
  providers: [provideBrowserGlobalErrorListeners(), provideHttpClient()],
};
