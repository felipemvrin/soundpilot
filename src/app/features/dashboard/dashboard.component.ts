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

const CONFIRMATION_TIMEOUT_MS = 15_000;

type CueHistoryAction =
  'detected' | 'queued' | 'played' | 'error' | 'confirmed' | 'dismissed' | 'expired';

interface CueHistoryItem {
  event: CueEvent;
  action: CueHistoryAction;
  timestamp: number;
}

interface PendingConfirmation {
  event: CueEvent;
  expiresAt: number;
}

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
  private readonly confirmationTimeouts = new Map<string, number>();
  private confirmationClock?: number;

  readonly cues = signal<Cue[]>(
    this.repository.load().length ? this.repository.load() : [DEFAULT_CUE],
  );
  readonly transcript = signal<TranscriptEvent | undefined>(undefined);
  readonly detectedCue = signal<CueEvent | undefined>(undefined);
  readonly events = signal<CueHistoryItem[]>([]);
  readonly pendingConfirmations = signal<PendingConfirmation[]>([]);
  readonly confirmationNow = signal(Date.now());
  readonly isListening = this.microphone.isListening;
  readonly audioLevel = this.microphone.level;
  readonly speechAvailable = this.speech.available;
  readonly readyLabel = computed(() => (this.isListening() ? 'LISTENING' : 'READY'));
  readonly canCreateCue = computed(() => {
    const draft = this.cueDraft();
    return Boolean(draft.name.trim() && draft.triggers.some((trigger) => trigger.value.trim()));
  });
  readonly cueDraft = signal<Cue>({
    ...DEFAULT_CUE,
    id: crypto.randomUUID(),
    triggers: [{ id: crypto.randomUUID(), value: '' }],
  });

  constructor() {
    this.subscriptions.add(
      this.speech.transcript$.subscribe((transcript) => this.processTranscript(transcript)),
    );
    this.confirmationClock = window.setInterval(() => this.confirmationNow.set(Date.now()), 1_000);
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
    const triggers = draft.triggers
      .map((trigger) => ({ ...trigger, value: trigger.value.trim() }))
      .filter((trigger) => trigger.value);
    if (!draft.name.trim() || !triggers.length) return;
    this.persist([...this.cues(), { ...draft, name: draft.name.trim(), triggers }]);
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

  updateDraftName(name: string): void {
    this.cueDraft.update((cue) => ({ ...cue, name }));
  }

  updateDraftTrigger(triggerId: string, value: string): void {
    this.cueDraft.update((cue) => ({
      ...cue,
      triggers: cue.triggers.map((trigger) =>
        trigger.id === triggerId ? { ...trigger, value } : trigger,
      ),
    }));
  }

  updateDraftMode(mode: Cue['mode']): void {
    this.cueDraft.update((cue) => ({ ...cue, mode }));
  }

  updateDraftCooldown(value: number): void {
    this.cueDraft.update((cue) => ({ ...cue, cooldownMs: Math.max(0, value) }));
  }

  selectAudioFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    this.cueDraft.update((cue) => ({ ...cue, audioFile: objectUrl }));
  }

  assignCueAudio(cue: Cue, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const audioFile = URL.createObjectURL(file);
    this.persist(this.cues().map((item) => (item.id === cue.id ? { ...item, audioFile } : item)));
  }

  async playCue(cue: Cue): Promise<void> {
    await this.player.play(cue);
  }

  async confirmCue(pending: PendingConfirmation): Promise<void> {
    const { event } = pending;
    this.removePendingConfirmation(event);
    this.addHistory(event, 'confirmed');
    const result = await this.player.play(event.cue);
    this.addHistory(event, result);
  }

  dismissCue(pending: PendingConfirmation): void {
    this.removePendingConfirmation(pending.event);
    this.addHistory(pending.event, 'dismissed');
  }

  remainingConfirmationSeconds(pending: PendingConfirmation): number {
    return Math.max(0, Math.ceil((pending.expiresAt - this.confirmationNow()) / 1_000));
  }

  triggerLabel(cue: Cue): string {
    return cue.triggers.map((trigger) => trigger.value).join(' · ');
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    if (this.confirmationClock !== undefined) window.clearInterval(this.confirmationClock);
    this.confirmationTimeouts.forEach((timeout) => window.clearTimeout(timeout));
    this.confirmationTimeouts.clear();
    this.speech.stop();
    this.microphone.stop();
    this.player.stopAll();
  }

  processTranscript(transcript: TranscriptEvent): void {
    this.transcript.set(transcript);
    if (!transcript.isFinal) return;
    const detected = this.engine.processTranscript(transcript, this.cues());
    for (const event of detected) {
      this.detectedCue.set(event);
      this.addHistory(event, 'detected');
      if (event.action === 'play') {
        void this.playAutomatically(event);
      } else if (event.action === 'confirm') {
        this.queueConfirmation(event);
      }
    }
  }

  private async playAutomatically(event: CueEvent): Promise<void> {
    const result = await this.player.play(event.cue);
    this.addHistory(event, result);
  }

  private queueConfirmation(event: CueEvent): void {
    if (this.pendingConfirmations().some((pending) => pending.event.cue.id === event.cue.id))
      return;

    const expiresAt = Date.now() + CONFIRMATION_TIMEOUT_MS;
    this.pendingConfirmations.update((pending) => [...pending, { event, expiresAt }]);
    this.addHistory(event, 'queued');
    const timeout = window.setTimeout(() => {
      this.confirmationTimeouts.delete(event.cue.id);
      if (this.pendingConfirmations().some((pending) => pending.event.cue.id === event.cue.id)) {
        this.removePendingConfirmation(event);
        this.addHistory(event, 'expired');
      }
    }, CONFIRMATION_TIMEOUT_MS);
    this.confirmationTimeouts.set(event.cue.id, timeout);
  }

  private removePendingConfirmation(event: CueEvent): void {
    const timeout = this.confirmationTimeouts.get(event.cue.id);
    if (timeout !== undefined) {
      window.clearTimeout(timeout);
      this.confirmationTimeouts.delete(event.cue.id);
    }
    this.pendingConfirmations.update((pending) =>
      pending.filter((item) => item.event.cue.id !== event.cue.id),
    );
  }

  private addHistory(event: CueEvent, action: CueHistoryAction): void {
    this.events.update((events) =>
      [{ event, action, timestamp: Date.now() }, ...events].slice(0, 12),
    );
  }

  private persist(cues: Cue[]): void {
    this.cues.set(cues);
    this.repository.save(cues);
  }
}
