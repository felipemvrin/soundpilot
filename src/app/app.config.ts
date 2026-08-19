import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { AUDIO_ENGINE_PORT } from './core/audio/audio-engine.port';
import { AudioPlayerService } from './core/audio/audio-player.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    { provide: AUDIO_ENGINE_PORT, useExisting: AudioPlayerService },
  ],
};
