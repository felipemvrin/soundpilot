import { describe, expect, it } from 'vitest';

import { Cue, CueEvent, TranscriptEvent } from '../models/cue.model';
import { TriggerEngineSnapshot } from '../models/trigger.model';
import { TriggerEngineService } from './trigger-engine.service';

const cue: Cue = {
  id: 'wife-laugh',
  name: 'ESPOSA',
  triggers: [{ id: 'wife', value: 'esposa' }],
  audioFile: 'sound.mp3',
  mode: 'automatic',
  enabled: true,
  cooldownMs: 3000,
  volume: 1,
  priority: 'normal',
  confidenceThreshold: 0.9,
};

const transcript: TranscriptEvent = {
  text: 'esposa',
  confidence: 0.95,
  timestamp: 1000,
  isFinal: true,
};

const match: CueEvent = {
  cue,
  trigger: cue.triggers[0],
  action: 'play',
  transcript,
  timestamp: transcript.timestamp,
};

const baseSnapshot: TriggerEngineSnapshot = {
  error: false,
  triggering: false,
  matched: false,
  cooldownActive: false,
  detecting: false,
  initializing: false,
  listening: false,
  paused: false,
};

describe('TriggerEngineService confidence evaluation', () => {
  const engine = new TriggerEngineService();

  it('marks high confidence matches as allowed', () => {
    const result = engine.evaluateConfidence(match, 0.95, 0.9);
    expect(result.level).toBe('high');
    expect(result.allowed).toBe(true);
  });

  it('marks medium confidence matches as allowed but not high', () => {
    const result = engine.evaluateConfidence(match, 0.8, 0.9);
    expect(result.level).toBe('medium');
    expect(result.allowed).toBe(true);
  });

  it('rejects low confidence automatic matches', () => {
    const result = engine.evaluateConfidence(match, 0.5, 0.9);
    expect(result.level).toBe('low');
    expect(result.allowed).toBe(false);
  });

  it('allows low confidence for non-automatic actions', () => {
    const manual: CueEvent = { ...match, action: 'display' };
    const result = engine.evaluateConfidence(manual, 0.5, 0.9);
    expect(result.level).toBe('low');
    expect(result.allowed).toBe(true);
  });

  it('reports unknown level when confidence is unavailable', () => {
    const result = engine.evaluateConfidence(match, undefined, 0.9);
    expect(result.level).toBe('unknown');
    expect(result.allowed).toBe(true);
  });
});

describe('TriggerEngineService state derivation', () => {
  const engine = new TriggerEngineService();

  it('resolves to idle when nothing else applies', () => {
    expect(engine.deriveState(baseSnapshot)).toBe('idle');
  });

  it('resolves to listening when the microphone is active', () => {
    expect(engine.deriveState({ ...baseSnapshot, listening: true })).toBe('listening');
  });

  it('resolves to paused when approved but not listening', () => {
    expect(engine.deriveState({ ...baseSnapshot, paused: true })).toBe('paused');
  });

  it('resolves to detecting while interim speech is arriving', () => {
    expect(engine.deriveState({ ...baseSnapshot, listening: true, detecting: true })).toBe(
      'detecting',
    );
  });

  it('resolves to cooldown after a trigger fires', () => {
    expect(engine.deriveState({ ...baseSnapshot, listening: true, cooldownActive: true })).toBe(
      'cooldown',
    );
  });

  it('resolves to matched above cooldown and detecting', () => {
    expect(
      engine.deriveState({
        ...baseSnapshot,
        listening: true,
        detecting: true,
        cooldownActive: true,
        matched: true,
      }),
    ).toBe('matched');
  });

  it('resolves to triggering above every other state except error', () => {
    expect(engine.deriveState({ ...baseSnapshot, matched: true, triggering: true })).toBe(
      'triggering',
    );
  });

  it('resolves to error above all other states', () => {
    expect(engine.deriveState({ ...baseSnapshot, triggering: true, error: true })).toBe('error');
  });
});

describe('TriggerEngineService cooldown remaining', () => {
  const engine = new TriggerEngineService();

  it('returns zero when there is no active cooldown', () => {
    expect(engine.cooldownRemainingMs(undefined, 1000)).toBe(0);
  });

  it('returns the remaining milliseconds until expiry', () => {
    expect(engine.cooldownRemainingMs(5000, 3000)).toBe(2000);
  });

  it('never returns a negative value once expired', () => {
    expect(engine.cooldownRemainingMs(1000, 3000)).toBe(0);
  });
});
