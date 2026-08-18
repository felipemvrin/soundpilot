import '@angular/compiler';
import { createEnvironmentInjector, runInInjectionContext, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AudioPlayerService } from '../../core/audio/audio-player.service';
import { MicrophoneService } from '../../core/audio/microphone.service';
import { Cue, CueEvent, TranscriptEvent } from '../../core/models/cue.model';
import { SpeechRecognitionService } from '../../core/speech/speech-recognition.service';
import { CueEngineService } from '../../core/services/cue-engine.service';
import { CueRepository } from '../../core/services/cue-repository.service';
import { DashboardComponent } from './dashboard.component';

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

const createDashboard = (playResult: 'played' | 'error' = 'played') => {
  const transcriptSubject = new Subject<TranscriptEvent>();
  const player = { play: vi.fn().mockResolvedValue(playResult), stopAll: vi.fn() };
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
      useValue: { processTranscript: vi.fn().mockReturnValue([event]) },
    },
    { provide: CueRepository, useValue: { load: vi.fn().mockReturnValue([cue]), save: vi.fn() } },
  ]);
  const component = runInInjectionContext(injector, () => new DashboardComponent());
  return { component, injector, player };
};

describe('DashboardComponent confirmation queue', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('queues confirm cues without playing them automatically', () => {
    const { component, injector, player } = createDashboard();
    component.processTranscript(transcript);
    expect(component.pendingConfirmations()).toHaveLength(1);
    expect(player.play).not.toHaveBeenCalled();
    component.ngOnDestroy();
    injector.destroy();
  });

  it('plays a confirmed cue and records the real player result', async () => {
    const { component, injector, player } = createDashboard('error');
    component.processTranscript(transcript);
    await component.confirmCue(component.pendingConfirmations()[0]);
    expect(component.pendingConfirmations()).toHaveLength(0);
    expect(player.play).toHaveBeenCalledWith(cue);
    expect(component.events().map((item) => item.action)).toContain('error');
    component.ngOnDestroy();
    injector.destroy();
  });

  it('dismisses a queued cue without playing it', () => {
    const { component, injector, player } = createDashboard();
    component.processTranscript(transcript);
    component.dismissCue(component.pendingConfirmations()[0]);
    expect(component.pendingConfirmations()).toHaveLength(0);
    expect(player.play).not.toHaveBeenCalled();
    expect(component.events().map((item) => item.action)).toContain('dismissed');
    component.ngOnDestroy();
    injector.destroy();
  });

  it('expires an unanswered confirmation after fifteen seconds', () => {
    const { component, injector } = createDashboard();
    component.processTranscript(transcript);
    vi.advanceTimersByTime(15_000);
    expect(component.pendingConfirmations()).toHaveLength(0);
    expect(component.events().map((item) => item.action)).toContain('expired');
    component.ngOnDestroy();
    injector.destroy();
  });

  it('keeps one pending confirmation when the same cue is detected repeatedly', () => {
    const { component, injector } = createDashboard();
    component.processTranscript(transcript);
    component.processTranscript({ ...transcript, timestamp: 2000 });
    expect(component.pendingConfirmations()).toHaveLength(1);
    expect(component.events().filter((item) => item.action === 'queued')).toHaveLength(1);
    component.ngOnDestroy();
    injector.destroy();
  });
});
