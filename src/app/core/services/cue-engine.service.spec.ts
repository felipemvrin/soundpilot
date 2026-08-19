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
    const confirmation = service.processTranscript(transcript('esposa', 9000), [
      cue({ mode: 'confirm' }),
    ])[0];
    expect(confirmation?.action).toBe('confirm');
    expect(confirmation?.action).not.toBe('play');
    expect(
      service.processTranscript(transcript('esposa', 13000), [cue({ mode: 'automatic' })])[0]
        ?.action,
    ).toBe('play');
  });

  it('selects one global match by specificity before cue priority', () => {
    const service = engine();
    const short = cue({
      id: 'short',
      name: 'SHORT',
      priority: 'high',
      triggers: [{ id: 'short-trigger', value: 'esposa' }],
    });
    const specific = cue({
      id: 'specific',
      name: 'SPECIFIC',
      priority: 'low',
      triggers: [{ id: 'specific-trigger', value: 'mi esposa' }],
    });

    const events = service.processTranscript(transcript('mi esposa llego'), [short, specific]);

    expect(events).toHaveLength(1);
    expect(events[0]?.cue.id).toBe('specific');
  });

  it('puts all matching candidates on cooldown, not just the winner', () => {
    const service = engine();
    const short = cue({
      id: 'short',
      name: 'SHORT',
      priority: 'high',
      triggers: [{ id: 'short-trigger', value: 'esposa' }],
    });
    const specific = cue({
      id: 'specific',
      name: 'SPECIFIC',
      priority: 'low',
      triggers: [{ id: 'specific-trigger', value: 'mi esposa' }],
    });

    // T=0: "mi esposa" matches both; specific wins
    expect(
      service.processTranscript(transcript('mi esposa', 1000), [short, specific]),
    ).toHaveLength(1);

    // T=2 (within cooldown): short lost but should also be on cooldown
    expect(service.processTranscript(transcript('esposa', 2000), [short, specific])).toHaveLength(
      0,
    );

    // T=5 (after cooldown): both are free again
    expect(service.processTranscript(transcript('esposa', 6000), [short])).toHaveLength(1);
  });

  it('uses cue priority when matching triggers have equal specificity', () => {
    const service = engine();
    const low = cue({ id: 'low', name: 'LOW', priority: 'low' });
    const high = cue({ id: 'high', name: 'HIGH', priority: 'high' });

    const events = service.processTranscript(transcript('esposa llego'), [low, high]);

    expect(events[0]?.cue.id).toBe('high');
  });
});
