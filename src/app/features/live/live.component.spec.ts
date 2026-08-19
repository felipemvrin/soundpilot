import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MicrophoneService } from '../../core/audio/microphone.service';
import { Cue, TranscriptEvent } from '../../core/models/cue.model';
import { CueRepository } from '../../core/services/cue-repository.service';
import { LiveSessionService } from '../../core/services/live-session.service';
import { SpeechRecognitionService } from '../../core/speech/speech-recognition.service';
import { LiveComponent } from './live.component';

const cue = (overrides: Partial<Cue> = {}): Cue => ({
  id: 'wife-laugh',
  name: 'ESPOSA',
  triggers: [{ id: 'wife', value: 'esposa' }],
  audioFile: 'wife.mp3',
  mode: 'automatic',
  enabled: true,
  cooldownMs: 3000,
  volume: 1,
  priority: 'normal',
  confidenceThreshold: 0.9,
  shortcut: 'F1',
  ...overrides,
});

const transcript = (overrides: Partial<TranscriptEvent> = {}): TranscriptEvent => ({
  text: 'esposa',
  confidence: 0.95,
  timestamp: 1000,
  isFinal: true,
  ...overrides,
});

interface Harness {
  fixture: ComponentFixture<LiveComponent>;
  component: LiveComponent;
  session: LiveSessionService;
  transcriptSubject: Subject<TranscriptEvent>;
}

const setup = (cues: Cue[] = [cue()]): Harness => {
  const transcriptSubject = new Subject<TranscriptEvent>();

  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      {
        provide: MicrophoneService,
        useValue: {
          isListening: signal(false),
          level: signal(0),
          bands: signal([]),
          start: vi.fn().mockResolvedValue(undefined),
          stop: vi.fn(),
        },
      },
      {
        provide: SpeechRecognitionService,
        useValue: {
          transcript$: transcriptSubject.asObservable(),
          available: signal(true),
          isRecognizing: signal(false),
          language: signal('es-ES'),
          start: vi.fn(),
          stop: vi.fn(),
        },
      },
      {
        provide: CueRepository,
        useValue: { load: vi.fn().mockReturnValue(cues), save: vi.fn() },
      },
    ],
  });

  const fixture = TestBed.createComponent(LiveComponent);
  const component = fixture.componentInstance;
  const session = TestBed.inject(LiveSessionService);
  fixture.detectChanges();
  return { fixture, component, session, transcriptSubject };
};

describe('LiveComponent', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders the four System Status items', () => {
    const { fixture } = setup();
    const labels = Array.from(fixture.nativeElement.querySelectorAll('.status-panel .label')).map(
      (element) => (element as HTMLElement).textContent,
    );
    expect(labels).toEqual(['Audio Input', 'Speech Engine', 'Trigger Engine', 'Cue Engine']);
  });

  it('shows the microphone as idle until listening starts', () => {
    const { fixture } = setup();
    expect(fixture.nativeElement.querySelector('.listening .label').textContent).toContain(
      'MICROPHONE IDLE',
    );
  });

  it('starts listening when the operator clicks the mic button', () => {
    const { fixture, session } = setup();
    const startSpy = vi.spyOn(session, 'toggleListening');
    const button = fixture.nativeElement.querySelector('.ops .btn--lg') as HTMLButtonElement;
    button.click();
    expect(startSpy).toHaveBeenCalled();
  });

  it('renders an armed trigger chip for every configured cue', () => {
    const { fixture } = setup([cue(), cue({ id: 'radio', name: 'RADIO', shortcut: 'F2' })]);
    const chips = fixture.nativeElement.querySelectorAll('app-cue-status-chip');
    expect(chips.length).toBe(2);
  });

  it('shows the empty triggers CTA when no cues are configured', () => {
    const { fixture, session } = setup([]);
    // LiveSessionService always falls back to a default cue when storage is empty; clear it explicitly.
    session.cues().forEach((existing) => session.removeCue(existing));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.empty-triggers')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.cues-strip a.btn--primary').textContent).toContain(
      'Create trigger',
    );
  });

  it('shows MATCH DETECTED and the cue name once a keyword is detected', () => {
    const { fixture, session, transcriptSubject } = setup([cue({ mode: 'manual' })]);
    transcriptSubject.next(transcript());
    fixture.detectChanges();
    expect(session.detection()?.event.cue.name).toBe('ESPOSA');
    const detected = fixture.nativeElement.querySelector('.detected');
    expect(detected.textContent).toContain('ESPOSA');
  });

  it('fires the matching cue from its F-key shortcut', () => {
    const { fixture, session } = setup([cue({ shortcut: 'F1' })]);
    const playSpy = vi.spyOn(session, 'playCue').mockResolvedValue(undefined);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F1' }));
    fixture.detectChanges();
    expect(playSpy).toHaveBeenCalledWith(expect.objectContaining({ shortcut: 'F1' }));
  });

  it('confirms a pending cue with the space bar', () => {
    const { fixture, session, transcriptSubject } = setup([cue({ mode: 'confirm' })]);
    transcriptSubject.next(transcript({ confidence: 0.95 }));
    fixture.detectChanges();
    expect(session.pendingConfirmations()).toHaveLength(1);

    const confirmSpy = vi.spyOn(session, 'confirmFirstPending').mockResolvedValue(undefined);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    fixture.detectChanges();
    expect(confirmSpy).toHaveBeenCalled();
  });
});
