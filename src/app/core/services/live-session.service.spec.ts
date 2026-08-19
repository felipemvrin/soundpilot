import { createEnvironmentInjector, runInInjectionContext, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AudioPlayerService } from '../audio/audio-player.service';
import { MicrophoneService } from '../audio/microphone.service';
import { Cue, CueEvent, TranscriptEvent } from '../models/cue.model';
import { SpeechRecognitionService } from '../speech/speech-recognition.service';
import { CueEngineService } from './cue-engine.service';
import { CueRepository } from './cue-repository.service';
import { LiveSessionService } from './live-session.service';
import { TextNormalizerService } from './text-normalizer.service';

const cue: Cue = {
  id: 'confirm-cue',
  name: 'CONFIRM',
  triggers: [{ id: 'trigger', value: 'confirmar' }],
  audioFile: 'sound.mp3',
  mode: 'confirm',
  enabled: true,
  cooldownMs: 3000,
  volume: 1,
  priority: 'normal',
};

const transcript: TranscriptEvent = {
  text: 'confirmar',
  confidence: 0.96,
  timestamp: 1000,
  isFinal: true,
};

const event: CueEvent = {
  cue,
  trigger: cue.triggers[0],
  action: 'confirm',
  transcript,
  timestamp: transcript.timestamp,
};

const createSession = (
  playResult: 'played' | 'error' = 'played',
  detected: CueEvent[] = [event],
) => {
  const transcriptSubject = new Subject<TranscriptEvent>();
  const player = {
    play: vi.fn().mockResolvedValue(playResult),
    stop: vi.fn(),
    stopAll: vi.fn(),
    replayLast: vi.fn().mockResolvedValue(playResult),
    setMasterVolume: vi.fn(),
    nowPlaying: signal(undefined),
    lastPlayed: signal(undefined),
  };
  const injector = createEnvironmentInjector([
    { provide: AudioPlayerService, useValue: player },
    {
      provide: MicrophoneService,
      useValue: { isListening: signal(false), level: signal(0), start: vi.fn(), stop: vi.fn() },
    },
    {
      provide: SpeechRecognitionService,
      useValue: {
        transcript$: transcriptSubject.asObservable(),
        available: signal(true),
        isRecognizing: signal(false),
        start: vi.fn(),
        stop: vi.fn(),
      },
    },
    {
      provide: CueEngineService,
      useValue: { processTranscript: vi.fn().mockReturnValue(detected) },
    },
    {
      provide: TextNormalizerService,
      useValue: { normalize: (value: string) => value.trim().toLowerCase() },
    },
    { provide: CueRepository, useValue: { load: vi.fn().mockReturnValue([cue]), save: vi.fn() } },
  ]);
  const session = runInInjectionContext(injector, () => new LiveSessionService());
  return { session, injector, player };
};

describe('LiveSessionService confirmation queue', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('queues confirm cues without playing them automatically', () => {
    const { session, injector, player } = createSession();
    session.processTranscript(transcript);
    expect(session.pendingConfirmations()).toHaveLength(1);
    expect(player.play).not.toHaveBeenCalled();
    session.dispose();
    injector.destroy();
  });

  it('plays a confirmed cue and records the real player result', async () => {
    const { session, injector, player } = createSession('error');
    session.processTranscript(transcript);
    await session.confirmPending(session.pendingConfirmations()[0]);
    expect(session.pendingConfirmations()).toHaveLength(0);
    expect(player.play).toHaveBeenCalledWith(cue);
    expect(session.events().map((item) => item.outcome)).toContain('error');
    session.dispose();
    injector.destroy();
  });

  it('ignores a queued cue without playing it', () => {
    const { session, injector, player } = createSession();
    session.processTranscript(transcript);
    session.ignorePending(session.pendingConfirmations()[0]);
    expect(session.pendingConfirmations()).toHaveLength(0);
    expect(player.play).not.toHaveBeenCalled();
    expect(session.events().map((item) => item.outcome)).toContain('ignored');
    session.dispose();
    injector.destroy();
  });

  it('expires an unanswered confirmation after fifteen seconds', () => {
    const { session, injector } = createSession();
    session.processTranscript(transcript);
    vi.advanceTimersByTime(15_000);
    expect(session.pendingConfirmations()).toHaveLength(0);
    expect(session.events().map((item) => item.outcome)).toContain('expired');
    session.dispose();
    injector.destroy();
  });

  it('keeps one pending confirmation when the same cue is detected repeatedly', () => {
    const { session, injector } = createSession();
    session.processTranscript(transcript);
    session.processTranscript({ ...transcript, timestamp: 2000 });
    expect(session.pendingConfirmations()).toHaveLength(1);
    expect(session.events().filter((item) => item.outcome === 'pending')).toHaveLength(1);
    session.dispose();
    injector.destroy();
  });

  it('clears pending confirmations when the cue is removed', () => {
    const { session, injector } = createSession();
    session.processTranscript(transcript);
    session.removeCue(cue);
    expect(session.pendingConfirmations()).toHaveLength(0);
    session.dispose();
    injector.destroy();
  });
});

describe('LiveSessionService confidence routing', () => {
  const automatic: Cue = { ...cue, id: 'auto', mode: 'automatic', confidenceThreshold: 0.9 };
  const automaticEvent = (confidence: number): CueEvent => ({
    cue: automatic,
    trigger: automatic.triggers[0],
    action: 'play',
    transcript: { ...transcript, confidence },
    timestamp: transcript.timestamp,
  });

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fires automatically above the cue threshold', () => {
    const { session, injector, player } = createSession('played', [automaticEvent(0.95)]);
    session.processTranscript({ ...transcript, confidence: 0.95 });
    expect(player.play).toHaveBeenCalledWith(automatic);
    session.dispose();
    injector.destroy();
  });

  it('asks for confirmation on medium confidence', () => {
    const { session, injector, player } = createSession('played', [automaticEvent(0.78)]);
    session.processTranscript({ ...transcript, confidence: 0.78 });
    expect(player.play).not.toHaveBeenCalled();
    expect(session.pendingConfirmations()).toHaveLength(1);
    session.dispose();
    injector.destroy();
  });

  it('ignores low confidence detections', () => {
    const { session, injector, player } = createSession('played', [automaticEvent(0.42)]);
    session.processTranscript({ ...transcript, confidence: 0.42 });
    expect(player.play).not.toHaveBeenCalled();
    expect(session.pendingConfirmations()).toHaveLength(0);
    expect(session.events()[0].detail).toBe('Low confidence');
    session.dispose();
    injector.destroy();
  });

  it('keeps the legacy behaviour when the engine reports no confidence', () => {
    const { session, injector, player } = createSession('played', [automaticEvent(0)]);
    session.processTranscript({ ...transcript, confidence: 0 });
    expect(player.play).toHaveBeenCalledWith(automatic);
    session.dispose();
    injector.destroy();
  });
});

describe('LiveSessionService cue configuration', () => {
  it('rejects duplicate normalized names, triggers and shortcuts', () => {
    const { session, injector } = createSession();
    session.updateCue({ ...cue, shortcut: 'F1' });
    const errors = session.validateCue({
      ...cue,
      id: 'second-cue',
      name: ' confirm ',
      triggers: [{ id: 'second-trigger', value: 'CONFIRMAR' }],
      shortcut: 'F1',
    });

    expect(errors.name).toBe('CUE NAME ALREADY EXISTS');
    expect(errors.triggers).toContain('TRIGGER CONFLICT');
    expect(errors.shortcut).toContain('SHORTCUT ALREADY ASSIGNED');
    session.dispose();
    injector.destroy();
  });

  it('persists a valid created cue through the shared cue store', () => {
    const { session, injector } = createSession();
    const newCue: Cue = {
      ...cue,
      id: 'new-cue',
      name: 'NEW CUE',
      triggers: [{ id: 'new-trigger', value: 'nuevo cue' }],
      shortcut: 'F2',
    };

    expect(session.saveCue(newCue)).toEqual({});
    expect(session.cues()).toContainEqual(newCue);
    session.dispose();
    injector.destroy();
  });
});
