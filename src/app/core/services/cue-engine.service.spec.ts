import '@angular/compiler';
import { createEnvironmentInjector, runInInjectionContext } from '@angular/core';
import { describe, expect, it } from 'vitest';

import { Cue, TranscriptEvent } from '../models/cue.model';
import { CueEngineService } from './cue-engine.service';
import { TextNormalizerService } from './text-normalizer.service';

const transcript = (text: string, timestamp = 1000): TranscriptEvent => ({
  text,
  confidence: 0.96,
  timestamp,
  isFinal: true,
});
const cue = (overrides: Partial<Cue> = {}): Cue => ({
  id: 'wife',
  name: 'ESPOSA',
  triggers: [
    { id: 'wife-trigger', value: 'esposa' },
    { id: 'phrase-trigger', value: 'mi esposa' },
  ],
  audioFile: 'wife.mp3',
  mode: 'automatic',
  enabled: true,
  cooldownMs: 3000,
  volume: 1,
  priority: 'normal',
  ...overrides,
});
const engine = (): CueEngineService => {
  const injector = createEnvironmentInjector([
    { provide: TextNormalizerService, useClass: TextNormalizerService },
  ]);
  return runInInjectionContext(injector, () => new CueEngineService());
};

describe('CueEngineService', () => {
  it('matches exact words and phrases, including case and accents', () => {
    const service = engine();
    expect(
      service.processTranscript(transcript('MI ESPOSA llego'), [cue()])[0]?.trigger.value,
    ).toBe('mi esposa');
    expect(service.processTranscript(transcript('la ESPÓSA volvió', 5000), [cue()])).toHaveLength(
      1,
    );
  });

  it('does not match a trigger inside another word', () => {
    const service = engine();
    expect(
      service.processTranscript(transcript('el pantalón azul'), [
        cue({ triggers: [{ id: 'bread', value: 'pan' }] }),
      ]),
    ).toHaveLength(0);
  });

  it('enforces cooldown independently by cue', () => {
    const service = engine();
    expect(service.processTranscript(transcript('esposa', 1000), [cue()])).toHaveLength(1);
    expect(service.processTranscript(transcript('esposa', 2000), [cue()])).toHaveLength(0);
    expect(service.processTranscript(transcript('esposa', 4000), [cue()])).toHaveLength(1);
  });

  it('skips disabled cues and maps every operating mode to an action', () => {
    const service = engine();
    expect(service.processTranscript(transcript('esposa'), [cue({ enabled: false })])).toHaveLength(
      0,
    );
    expect(
      service.processTranscript(transcript('esposa', 5000), [cue({ mode: 'manual' })])[0]?.action,
    ).toBe('display');
    expect(
      service.processTranscript(transcript('esposa', 9000), [cue({ mode: 'confirm' })])[0]?.action,
    ).toBe('confirm');
    expect(
      service.processTranscript(transcript('esposa', 13000), [cue({ mode: 'automatic' })])[0]
        ?.action,
    ).toBe('play');
  });
});
