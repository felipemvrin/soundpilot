import { InjectionToken } from '@angular/core';

import { Cue } from '../models/cue.model';

export type AudioEngineResult = 'played' | 'error';

/** Port consumed by trigger decisions; the current adapter is browser HTMLAudioElement playback. */
export interface AudioEnginePort {
  play(cue: Cue): Promise<AudioEngineResult>;
  stop(cueId: string): void;
  stopAll(): void;
}

export const AUDIO_ENGINE_PORT = new InjectionToken<AudioEnginePort>('AUDIO_ENGINE_PORT');
