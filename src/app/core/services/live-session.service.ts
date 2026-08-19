import { Injectable, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';

import { AudioPlayerService } from '../audio/audio-player.service';
import { MicrophoneService } from '../audio/microphone.service';
import {
  ConfidenceLevel,
  Cue,
  CueEvent,
  CueRuntimeStatus,
  SystemStatus,
  TranscriptEvent,
} from '../models/cue.model';
import {
  CueDetection,
  OperationError,
  PendingConfirmation,
  SessionEvent,
  SessionOutcome,
} from '../models/session.model';
import { SpeechRecognitionService } from '../speech/speech-recognition.service';
import { CueEngineService } from './cue-engine.service';
import { CueRepository } from './cue-repository.service';
import { TextNormalizerService } from './text-normalizer.service';

export const CONFIRMATION_TIMEOUT_MS = 15_000;
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.9;
export const MIN_CONFIDENCE = 0.7;
const MAX_EVENTS = 40;
const PLAYED_FLASH_MS = 2_500;

export interface CueValidationErrors {
  name?: string;
  audio?: string;
  triggers?: string;
  shortcut?: string;
  confidence?: string;
  cooldown?: string;
}

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
  confidenceThreshold: DEFAULT_CONFIDENCE_THRESHOLD,
  shortcut: 'F1',
};

/**
 * Single source of truth shared by the LIVE, CUES and SETTINGS views.
 * Owns cue persistence, detection routing, confirmation queue and session history.
 */
@Injectable({ providedIn: 'root' })
export class LiveSessionService {
  private readonly microphone = inject(MicrophoneService);
  private readonly speech = inject(SpeechRecognitionService);
  private readonly engine = inject(CueEngineService);
  private readonly repository = inject(CueRepository);
  private readonly player = inject(AudioPlayerService);
  private readonly normalizer = inject(TextNormalizerService);
  private readonly subscriptions = new Subscription();
  private readonly confirmationTimeouts = new Map<string, number>();
  private readonly playedFlash = new Map<string, number>();
  private readonly clock?: number;

  readonly cues = signal<Cue[]>(this.loadCues());
  readonly transcript = signal<TranscriptEvent | undefined>(undefined);
  readonly detection = signal<CueDetection | undefined>(undefined);
  readonly events = signal<SessionEvent[]>([]);
  readonly pendingConfirmations = signal<PendingConfirmation[]>([]);
  readonly now = signal(Date.now());
  readonly airMode = signal(false);
  readonly muted = signal(false);
  readonly masterVolume = signal(1);
  readonly error = signal<OperationError | undefined>(undefined);
  readonly recentlyPlayed = signal<readonly string[]>([]);

  readonly isListening = this.microphone.isListening;
  readonly audioLevel = this.microphone.level;
  readonly speechAvailable = this.speech.available;
  readonly isRecognizing = this.speech.isRecognizing;
  readonly nowPlaying = this.player.nowPlaying;
  readonly lastPlayed = this.player.lastPlayed;

  readonly enabledCues = computed(() => this.cues().filter((cue) => cue.enabled));
  readonly hasPendingConfirmations = computed(() => this.pendingConfirmations().length > 0);

  readonly systemStatus = computed<SystemStatus>(() => {
    if (this.error()) return 'error';
    if (this.nowPlaying()) return 'playing';
    if (this.hasPendingConfirmations()) return 'processing';
    if (this.isListening()) return 'listening';
    return 'ready';
  });

  readonly playbackElapsedMs = computed(() => {
    const playing = this.nowPlaying();
    return playing ? Math.max(0, this.now() - playing.startedAt) : 0;
  });

  constructor() {
    this.subscriptions.add(
      this.speech.transcript$.subscribe((transcript) => this.processTranscript(transcript)),
    );
    this.clock = setInterval(() => this.now.set(Date.now()), 500) as unknown as number;
  }

  // ---------------------------------------------------------------- listening

  async toggleListening(): Promise<void> {
    if (this.isListening()) {
      this.stopListening();
      return;
    }
    await this.startListening();
  }

  async startListening(): Promise<void> {
    if (this.isListening()) return;
    try {
      await this.microphone.start();
      this.error.set(undefined);
      if (this.speech.available()) {
        this.speech.start();
      } else {
        this.error.set({
          title: 'Speech recognition unavailable',
          detail:
            'This browser does not expose the Web Speech API. Cues can still be fired manually with keyboard shortcuts.',
          actionLabel: 'Open settings',
          actionRoute: '/settings',
        });
      }
    } catch {
      this.microphone.stop();
      this.error.set({
        title: 'Microphone unavailable',
        detail:
          'Check that the microphone is connected and that SoundPilot has permission to access it.',
        actionLabel: 'Open settings',
        actionRoute: '/settings',
      });
    }
  }

  stopListening(): void {
    this.speech.stop();
    this.microphone.stop();
  }

  dismissError(): void {
    this.error.set(undefined);
  }

  toggleAirMode(): void {
    this.airMode.update((value) => !value);
  }

  setMasterVolume(volume: number): void {
    this.masterVolume.set(volume);
    if (!this.muted()) this.player.setMasterVolume(volume);
  }

  toggleMute(): void {
    const muted = !this.muted();
    this.muted.set(muted);
    this.player.setMasterVolume(muted ? 0 : this.masterVolume());
  }

  // ------------------------------------------------------------------- cues

  addCue(cue: Cue): void {
    this.persist([...this.cues(), cue]);
  }

  updateCue(cue: Cue): void {
    this.persist(this.cues().map((item) => (item.id === cue.id ? cue : item)));
  }

  saveCue(cue: Cue): CueValidationErrors {
    const errors = this.validateCue(cue);
    if (Object.keys(errors).length) return errors;

    const exists = this.cues().some((item) => item.id === cue.id);
    if (exists) {
      this.updateCue(cue);
    } else {
      this.addCue(cue);
    }
    return {};
  }

  validateCue(cue: Cue): CueValidationErrors {
    const errors: CueValidationErrors = {};
    const name = cue.name.trim();
    const normalizedName = this.normalizer.normalize(name);
    const requiresTrigger = cue.mode !== 'manual';

    if (!name) {
      errors.name = 'Cue name is required.';
    } else if (
      this.cues().some(
        (item) => item.id !== cue.id && this.normalizer.normalize(item.name) === normalizedName,
      )
    ) {
      errors.name = 'CUE NAME ALREADY EXISTS';
    }

    if ((cue.mode === 'automatic' || cue.mode === 'confirm') && !cue.audioFile) {
      errors.audio = 'Audio is required for automatic and confirmation cues.';
    }

    const normalizedTriggers = cue.triggers.map((trigger) =>
      this.normalizer.normalize(trigger.value),
    );
    if (requiresTrigger && !normalizedTriggers.length) {
      errors.triggers = 'Add at least one trigger.';
    } else if (normalizedTriggers.some((trigger) => !trigger)) {
      errors.triggers = 'Triggers cannot be empty.';
    } else if (new Set(normalizedTriggers).size !== normalizedTriggers.length) {
      errors.triggers = 'Triggers must be unique.';
    } else {
      for (const trigger of normalizedTriggers) {
        const conflictingCue = this.cues().find(
          (item) =>
            item.id !== cue.id &&
            item.triggers.some(
              (candidate) => this.normalizer.normalize(candidate.value) === trigger,
            ),
        );
        if (conflictingCue) {
          errors.triggers = `TRIGGER CONFLICT: "${trigger}" is already assigned to ${conflictingCue.name}.`;
          break;
        }
      }
    }

    if (
      cue.shortcut &&
      this.cues().some((item) => item.id !== cue.id && item.shortcut === cue.shortcut)
    ) {
      const conflictingCue = this.cues().find(
        (item) => item.id !== cue.id && item.shortcut === cue.shortcut,
      );
      errors.shortcut = `SHORTCUT ALREADY ASSIGNED: ${cue.shortcut} is already assigned to ${conflictingCue?.name}.`;
    }
    if (
      cue.confidenceThreshold !== undefined &&
      (!Number.isFinite(cue.confidenceThreshold) ||
        cue.confidenceThreshold < 0 ||
        cue.confidenceThreshold > 1)
    ) {
      errors.confidence = 'Confidence must be between 0% and 100%.';
    }
    if (!Number.isFinite(cue.cooldownMs) || cue.cooldownMs < 0) {
      errors.cooldown = 'Cooldown must be zero or greater.';
    }
    return errors;
  }

  toggleCue(cue: Cue): void {
    this.persist(
      this.cues().map((item) => (item.id === cue.id ? { ...item, enabled: !item.enabled } : item)),
    );
  }

  removeCue(cue: Cue): void {
    this.removePendingConfirmationByCueId(cue.id);
    this.persist(this.cues().filter((item) => item.id !== cue.id));
  }

  reorderShortcuts(): void {
    this.persist(
      this.cues().map((cue, index) => ({
        ...cue,
        shortcut: index < 9 ? `F${index + 1}` : undefined,
      })),
    );
  }

  cueFor(index: number): Cue | undefined {
    return this.enabledCues()[index];
  }

  runtimeStatus(cue: Cue): CueRuntimeStatus {
    if (this.nowPlaying()?.cueId === cue.id) return 'playing';
    if (this.pendingConfirmations().some((pending) => pending.event.cue.id === cue.id))
      return 'pending';
    if (!cue.enabled) return 'disabled';
    if (this.recentlyPlayed().includes(cue.id)) return 'played';
    if (!cue.audioFile) return 'error';
    return 'ready';
  }

  // --------------------------------------------------------------- playback

  async playCue(cue: Cue): Promise<void> {
    const result = await this.player.play(cue);
    this.record({
      cueId: cue.id,
      cueName: cue.name,
      outcome: result === 'played' ? 'played' : 'error',
      detail: result === 'error' ? this.playbackErrorDetail(cue) : 'Manual',
    });
    if (result === 'played') this.flashPlayed(cue.id);
  }

  stopPlayback(): void {
    const playing = this.nowPlaying();
    if (!playing) return;
    this.player.stop(playing.cueId);
    this.record({
      cueId: playing.cueId,
      cueName: playing.cueName,
      outcome: 'stopped',
      detail: 'Stopped by operator',
    });
  }

  async replayLast(): Promise<void> {
    const last = this.lastPlayed();
    if (!last) return;
    const result = await this.player.replayLast();
    if (result === 'unavailable') return;
    this.record({
      cueId: last.cueId,
      cueName: last.cueName,
      outcome: result === 'played' ? 'played' : 'error',
      detail: 'Replay',
    });
    if (result === 'played') this.flashPlayed(last.cueId);
  }

  // ----------------------------------------------------------- confirmations

  async confirmPending(pending: PendingConfirmation): Promise<void> {
    const { event } = pending;
    this.removePendingConfirmation(event);
    const result = await this.player.play(event.cue);
    this.record({
      cueId: event.cue.id,
      cueName: event.cue.name,
      trigger: event.trigger.value,
      phrase: event.transcript.text,
      confidence: pending.confidence,
      outcome: result === 'played' ? 'played' : 'error',
      detail: result === 'error' ? this.playbackErrorDetail(event.cue) : 'Confirmed',
    });
    if (result === 'played') this.flashPlayed(event.cue.id);
  }

  ignorePending(pending: PendingConfirmation): void {
    this.removePendingConfirmation(pending.event);
    this.record({
      cueId: pending.event.cue.id,
      cueName: pending.event.cue.name,
      trigger: pending.event.trigger.value,
      phrase: pending.event.transcript.text,
      confidence: pending.confidence,
      outcome: 'ignored',
      detail: 'Ignored by operator',
    });
  }

  async confirmFirstPending(): Promise<void> {
    const [first] = this.pendingConfirmations();
    if (first) await this.confirmPending(first);
  }

  ignoreFirstPending(): void {
    const [first] = this.pendingConfirmations();
    if (first) this.ignorePending(first);
  }

  remainingConfirmationSeconds(pending: PendingConfirmation): number {
    return Math.max(0, Math.ceil((pending.expiresAt - this.now()) / 1_000));
  }

  // ------------------------------------------------------------- detection

  processTranscript(transcript: TranscriptEvent): void {
    this.transcript.set(transcript);
    if (!transcript.isFinal) return;
    const detected = this.engine.processTranscript(transcript, this.cues());
    for (const event of detected) {
      const confidence = this.confidenceOf(transcript);
      const level = this.confidenceLevel(confidence, event.cue);
      const requiresConfirmation =
        event.action === 'confirm' || (event.action === 'play' && level === 'medium');
      this.detection.set({ event, confidence, level, requiresConfirmation });

      if (event.action === 'play' && level === 'low') {
        this.record({
          cueId: event.cue.id,
          cueName: event.cue.name,
          trigger: event.trigger.value,
          phrase: transcript.text,
          confidence,
          outcome: 'ignored',
          detail: 'Low confidence',
        });
        continue;
      }

      if (requiresConfirmation) {
        this.queueConfirmation(event, confidence, level);
        continue;
      }

      if (event.action === 'play') {
        void this.playDetected(event, confidence);
        continue;
      }

      this.record({
        cueId: event.cue.id,
        cueName: event.cue.name,
        trigger: event.trigger.value,
        phrase: transcript.text,
        confidence,
        outcome: 'detected',
        detail: 'Manual mode',
      });
    }
  }

  confidenceOf(transcript: TranscriptEvent): number | undefined {
    return Number.isFinite(transcript.confidence) && transcript.confidence > 0
      ? transcript.confidence
      : undefined;
  }

  confidenceLevel(confidence: number | undefined, cue?: Cue): ConfidenceLevel {
    if (confidence === undefined) return 'unknown';
    const threshold = cue?.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;
    if (confidence >= threshold) return 'high';
    if (confidence >= MIN_CONFIDENCE) return 'medium';
    return 'low';
  }

  dispose(): void {
    this.subscriptions.unsubscribe();
    if (this.clock !== undefined) clearInterval(this.clock);
    this.confirmationTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.confirmationTimeouts.clear();
    this.playedFlash.forEach((timeout) => clearTimeout(timeout));
    this.playedFlash.clear();
    this.stopListening();
    this.player.stopAll();
  }

  // ------------------------------------------------------------- internals

  private async playDetected(event: CueEvent, confidence?: number): Promise<void> {
    const result = await this.player.play(event.cue);
    this.record({
      cueId: event.cue.id,
      cueName: event.cue.name,
      trigger: event.trigger.value,
      phrase: event.transcript.text,
      confidence,
      outcome: result === 'played' ? 'played' : 'error',
      detail: result === 'error' ? this.playbackErrorDetail(event.cue) : 'Automatic',
    });
    if (result === 'played') this.flashPlayed(event.cue.id);
  }

  private queueConfirmation(
    event: CueEvent,
    confidence: number | undefined,
    level: ConfidenceLevel,
  ): void {
    if (this.pendingConfirmations().some((pending) => pending.event.cue.id === event.cue.id))
      return;

    const expiresAt = Date.now() + CONFIRMATION_TIMEOUT_MS;
    this.pendingConfirmations.update((pending) => [
      ...pending,
      { event, expiresAt, confidence, level },
    ]);
    this.record({
      cueId: event.cue.id,
      cueName: event.cue.name,
      trigger: event.trigger.value,
      phrase: event.transcript.text,
      confidence,
      outcome: 'pending',
      detail:
        level === 'medium' ? 'Confirmation required (medium confidence)' : 'Awaiting confirmation',
    });
    const timeout = setTimeout(() => {
      this.confirmationTimeouts.delete(event.cue.id);
      if (this.pendingConfirmations().some((pending) => pending.event.cue.id === event.cue.id)) {
        this.removePendingConfirmation(event);
        this.record({
          cueId: event.cue.id,
          cueName: event.cue.name,
          trigger: event.trigger.value,
          phrase: event.transcript.text,
          confidence,
          outcome: 'expired',
          detail: 'No answer within 15s',
        });
      }
    }, CONFIRMATION_TIMEOUT_MS) as unknown as number;
    this.confirmationTimeouts.set(event.cue.id, timeout);
  }

  private removePendingConfirmation(event: CueEvent): void {
    this.removePendingConfirmationByCueId(event.cue.id);
  }

  private removePendingConfirmationByCueId(cueId: string): void {
    const timeout = this.confirmationTimeouts.get(cueId);
    if (timeout !== undefined) {
      clearTimeout(timeout);
      this.confirmationTimeouts.delete(cueId);
    }
    this.pendingConfirmations.update((pending) =>
      pending.filter((item) => item.event.cue.id !== cueId),
    );
  }

  private flashPlayed(cueId: string): void {
    const previous = this.playedFlash.get(cueId);
    if (previous !== undefined) clearTimeout(previous);
    this.recentlyPlayed.update((ids) => (ids.includes(cueId) ? ids : [...ids, cueId]));
    const timeout = setTimeout(() => {
      this.playedFlash.delete(cueId);
      this.recentlyPlayed.update((ids) => ids.filter((id) => id !== cueId));
    }, PLAYED_FLASH_MS) as unknown as number;
    this.playedFlash.set(cueId, timeout);
  }

  private playbackErrorDetail(cue: Cue): string {
    return cue.audioFile
      ? 'Playback failed. Check the audio output device.'
      : 'No audio file assigned to this cue.';
  }

  private record(
    event: Omit<SessionEvent, 'id' | 'timestamp'> & { outcome: SessionOutcome },
  ): void {
    this.events.update((events) =>
      [{ ...event, id: crypto.randomUUID(), timestamp: Date.now() }, ...events].slice(
        0,
        MAX_EVENTS,
      ),
    );
  }

  private loadCues(): Cue[] {
    const stored = this.repository.load();
    return stored.length ? stored : [DEFAULT_CUE];
  }

  private persist(cues: Cue[]): void {
    this.cues.set(cues);
    this.repository.save(cues);
  }
}
