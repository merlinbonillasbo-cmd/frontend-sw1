import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Polyfill for browser bundles that expect Node's global.
if (typeof globalThis !== 'undefined' && !(globalThis as { global?: unknown }).global) {
  (globalThis as { global?: unknown }).global = globalThis;
}

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
