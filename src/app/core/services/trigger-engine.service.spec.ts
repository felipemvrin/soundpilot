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
    expect(result.allowed).toBe(false);
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

describe('TriggerEngineService diagnostics', () => {
  it('does not emit diagnostics when debug logging is disabled', () => {
    const engine = new TriggerEngineService();
    const events: unknown[] = [];
    const subscription = engine.diagnostics$.subscribe((event) => events.push(event));

    engine.log({ stage: 'transcription-received', timestamp: 1000 });

    expect(events).toHaveLength(0);
    subscription.unsubscribe();
  });

  it('emits diagnostics when debug logging is enabled', () => {
    const settingsStub = {
      settings: () => ({ trigger: { debugLogging: true } }),
    } as unknown as import('./settings.service').SettingsService;
    const engine = new TriggerEngineService(settingsStub);
    const events: unknown[] = [];
    const subscription = engine.diagnostics$.subscribe((event) => events.push(event));

    const diagnostic = { stage: 'transcription-received' as const, timestamp: 1000 };
    engine.log(diagnostic);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject(diagnostic);
    subscription.unsubscribe();
  });

  it('emits diagnostics from emitDecision regardless of debugLogging setting', () => {
    const engine = new TriggerEngineService();
    const events: unknown[] = [];
    const subscription = engine.diagnostics$.subscribe((event) => events.push(event));

    engine.emitDecision({
      id: 'event-0',
      timestamp: 900,
      state: 'listening',
      decision: 'rejected',
      reason: 'no-match',
    });

    expect(events).toHaveLength(1);
    subscription.unsubscribe();
  });

  it('includes decision metadata and latency in diagnostics for accepted triggers', () => {
    const engine = new TriggerEngineService();
    const events: unknown[] = [];
    const subscription = engine.diagnostics$.subscribe((event) => events.push(event));

    engine.emitDecision({
      id: 'event-1',
      timestamp: 1000,
      state: 'triggering',
      cueId: cue.id,
      cueName: cue.name,
      keyword: cue.triggers[0].value,
      phrase: 'esposa',
      recognitionConfidence: 0.95,
      matchConfidence: 0.97,
      decision: 'accepted',
      reason: 'automatic-cue-accepted',
      source: 'speech-recognition',
      latencyMs: 120,
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      stage: 'decision-accepted',
      cueId: cue.id,
      keyword: cue.triggers[0].value,
      reason: 'automatic-cue-accepted',
      latencyMs: 120,
      details: {
        decision: 'accepted',
        state: 'triggering',
        recognitionConfidence: 0.95,
        matchConfidence: 0.97,
        source: 'speech-recognition',
      },
    });
    subscription.unsubscribe();
  });
});

describe('TriggerEngineService event contract', () => {
  it('emits a decision event for downstream audio consumers', () => {
    const engine = new TriggerEngineService();
    const events: unknown[] = [];
    const subscription = engine.triggerEvent$.subscribe((event) => events.push(event));

    engine.emitDecision({
      id: 'event-1',
      timestamp: 1000,
      state: 'triggering',
      cueId: cue.id,
      keyword: cue.triggers[0].value,
      recognitionConfidence: 0.95,
      decision: 'accepted',
      reason: 'automatic-cue-accepted',
      source: 'speech-recognition',
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ decision: 'accepted', cueId: cue.id });
    subscription.unsubscribe();
  });
});
