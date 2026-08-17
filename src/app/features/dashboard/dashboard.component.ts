import { DatePipe } from '@angular/common';
import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { AudioPlayerService } from '../../core/audio/audio-player.service';
import { MicrophoneService } from '../../core/audio/microphone.service';
import { Cue, CueEvent, TranscriptEvent } from '../../core/models/cue.model';
import { SpeechRecognitionService } from '../../core/speech/speech-recognition.service';
import { CueEngineService } from '../../core/services/cue-engine.service';
import { CueRepository } from '../../core/services/cue-repository.service';

const DEFAULT_CUE: Cue = {
  id: 'wife-laugh',
  name: 'ESPOSA',
  triggers: [
    { id: 'wife', value: 'esposa' },
    { id: 'my-wife', value: 'mi esposa' },
    { id: 'the-wife', value: 'la esposa' },
  ],
  audioFile: '',
  mode: 'automatic',
  enabled: true,
  cooldownMs: 3000,
  volume: 1,
  priority: 'normal',
};

@Component({
  selector: 'app-dashboard',
  imports: [DatePipe, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnDestroy {
  private readonly microphone = inject(MicrophoneService);
  private readonly speech = inject(SpeechRecognitionService);
  private readonly engine = inject(CueEngineService);
  private readonly repository = inject(CueRepository);
  private readonly player = inject(AudioPlayerService);
  private readonly subscriptions = new Subscription();

  readonly cues = signal<Cue[]>(
    this.repository.load().length ? this.repository.load() : [DEFAULT_CUE],
  );
  readonly transcript = signal<TranscriptEvent | undefined>(undefined);
  readonly detectedCue = signal<CueEvent | undefined>(undefined);
  readonly events = signal<CueEvent[]>([]);
  readonly isListening = this.microphone.isListening;
  readonly audioLevel = this.microphone.level;
  readonly speechAvailable = this.speech.available;
  readonly readyLabel = computed(() => (this.isListening() ? 'LISTENING' : 'READY'));
  readonly cueDraft = signal<Cue>({
    ...DEFAULT_CUE,
    id: crypto.randomUUID(),
    triggers: [{ id: crypto.randomUUID(), value: '' }],
  });

  constructor() {
    this.subscriptions.add(
      this.speech.transcript$.subscribe((transcript) => this.handleTranscript(transcript)),
    );
  }

  async toggleListening(): Promise<void> {
    if (this.isListening()) {
      this.speech.stop();
      this.microphone.stop();
      return;
    }
    try {
      await this.microphone.start();
      this.speech.start();
    } catch {
      this.microphone.stop();
    }
  }

  addCue(): void {
    const draft = this.cueDraft();
    const triggers = draft.triggers.filter((trigger) => trigger.value.trim());
    if (!draft.name.trim() || !triggers.length) return;
    this.persist([...this.cues(), { ...draft, triggers }]);
    this.cueDraft.set({
      ...DEFAULT_CUE,
      id: crypto.randomUUID(),
      triggers: [{ id: crypto.randomUUID(), value: '' }],
    });
  }

  toggleCue(cue: Cue): void {
    this.persist(
      this.cues().map((item) => (item.id === cue.id ? { ...item, enabled: !item.enabled } : item)),
    );
  }

  removeCue(cue: Cue): void {
    this.persist(this.cues().filter((item) => item.id !== cue.id));
  }

  addTrigger(): void {
    this.cueDraft.update((cue) => ({
      ...cue,
      triggers: [...cue.triggers, { id: crypto.randomUUID(), value: '' }],
    }));
  }

  selectAudioFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    this.cueDraft.update((cue) => ({ ...cue, audioFile: objectUrl }));
  }

  async playCue(cue: Cue): Promise<void> {
    await this.player.play(cue);
  }

  triggerLabel(cue: Cue): string {
    return cue.triggers.map((trigger) => trigger.value).join(' · ');
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.speech.stop();
    this.microphone.stop();
    this.player.stopAll();
  }

  private handleTranscript(transcript: TranscriptEvent): void {
    this.transcript.set(transcript);
    if (!transcript.isFinal) return;
    const detected = this.engine.processTranscript(transcript, this.cues());
    for (const event of detected) {
      this.detectedCue.set(event);
      this.events.update((events) => [event, ...events].slice(0, 8));
      if (event.action === 'play') void this.playCue(event.cue);
    }
  }

  private persist(cues: Cue[]): void {
    this.cues.set(cues);
    this.repository.save(cues);
  }
}
