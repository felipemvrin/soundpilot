import { Injectable, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';

import { AudioPlayerService } from '../audio/audio-player.service';
import { AUDIO_ENGINE_PORT, AudioEnginePort } from '../audio/audio-engine.port';
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
  PreflightStatus,
  SessionEvent,
  SessionOutcome,
} from '../models/session.model';
import { TriggerDiagnosticEvent, TriggerState } from '../models/trigger.model';
import { SpeechRecognitionService } from '../speech/speech-recognition.service';
import { CueEngineService } from './cue-engine.service';
import { CueRepository } from './cue-repository.service';
import { TextNormalizerService } from './text-normalizer.service';
import { TriggerEngineService } from './trigger-engine.service';

export const CONFIRMATION_TIMEOUT_MS = 15_000;
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.9;
/** Detected match stays visible in the UI (MATCH DETECTED panel) for this long before fading back to LISTENING. */
const DETECTION_HOLD_MS = 4_000;
/** Interim (non-final) speech keeps the engine in the DETECTING state for this long after the last chunk. */
const SPEECH_ACTIVITY_MS = 1_500;
const MAX_EVENTS = 40;
const PLAYED_FLASH_MS = 2_500;
const PREFLIGHT_AIR_MODE_ERROR_TITLE = 'Run preflight before entering air mode';

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
  private readonly audioEngine: AudioEnginePort =
    inject(AUDIO_ENGINE_PORT, { optional: true }) ?? this.player;
  private readonly normalizer = inject(TextNormalizerService);
  private readonly triggerEngine = inject(TriggerEngineService);
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
  readonly latestDiagnostic = signal<TriggerDiagnosticEvent | undefined>(undefined);
  readonly airMode = signal(false);
  readonly preflightApproved = signal(false);
  readonly muted = signal(false);
  readonly masterVolume = signal(1);
  readonly error = signal<OperationError | undefined>(undefined);
  readonly recentlyPlayed = signal<readonly string[]>([]);

  /** True while `startListening()` is waiting on the microphone/speech APIs. */
  readonly initializing = signal(false);
  /** Timestamp of the last keyword match, used to hold the MATCH DETECTED panel visible briefly. */
  readonly lastDetectionAt = signal<number | undefined>(undefined);
  /** Per-cue cooldown expiry, mirrors `CueEngineService`'s internal bookkeeping for UI feedback. */
  readonly cooldowns = signal<ReadonlyMap<string, number>>(new Map());

  readonly isListening = this.microphone.isListening;
  readonly audioLevel = this.microphone.level;
  /** Real per-band frequency levels for waveform visualizers (e.g. LIVE LISTENING). */
  readonly audioBands = this.microphone.bands;
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

  /** Whether a match is still within its short display window (MATCH DETECTED panel). */
  readonly detectionActive = computed(() => {
    const at = this.lastDetectionAt();
    return at !== undefined && this.now() - at < DETECTION_HOLD_MS;
  });

  /** Whether interim speech has arrived recently enough to consider the engine actively DETECTING. */
  readonly speechActivity = computed(() => {
    const last = this.transcript();
    return last !== undefined && this.now() - last.timestamp < SPEECH_ACTIVITY_MS;
  });

  /** True while any cue is still cooling down from a recent trigger. */
  readonly cooldownActive = computed(() =>
    [...this.cooldowns().values()].some((expiresAt) => expiresAt > this.now()),
  );

  /** Trigger Engine lifecycle state, meant to be shown directly in the LIVE view. */
  readonly triggerState = computed<TriggerState>(() =>
    this.triggerEngine.deriveState({
      error: this.error() !== undefined,
      triggering: this.nowPlaying() !== undefined,
      matched: this.hasPendingConfirmations() || this.detectionActive(),
      cooldownActive: this.cooldownActive(),
      detecting: this.speechActivity(),
      initializing: this.initializing(),
      listening: this.isListening(),
      paused: this.preflightApproved() && !this.isListening(),
    }),
  );

  readonly playbackElapsedMs = computed(() => {
    const playing = this.nowPlaying();
    return playing ? Math.max(0, this.now() - playing.startedAt) : 0;
  });

  constructor() {
    this.subscriptions.add(
      this.speech.transcript$.subscribe((transcript) => this.processTranscript(transcript)),
    );
    this.subscriptions.add(
      this.triggerEngine.diagnostics$.subscribe((event) => this.latestDiagnostic.set(event)),
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
    this.initializing.set(true);
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
    } finally {
      this.initializing.set(false);
    }
  }

  stopListening(): void {
    this.speech.stop();
    this.microphone.stop();
  }

  dismissError(): void {
    this.error.set(undefined);
  }

  recordPreflight(status: PreflightStatus): void {
    const approved = status === 'ready' || status === 'ready-with-warnings';
    this.preflightApproved.set(approved);
    if (approved && this.error()?.title === PREFLIGHT_AIR_MODE_ERROR_TITLE) {
      this.error.set(undefined);
    }
  }

  invalidatePreflight(): void {
    this.preflightApproved.set(false);
  }

  toggleAirMode(): void {
    if (this.airMode()) {
      this.airMode.set(false);
      return;
    }
    if (!this.preflightApproved()) {
      this.error.set({
        title: PREFLIGHT_AIR_MODE_ERROR_TITLE,
        detail: 'Run preflight in LIVE and resolve any blocking checks before going on air.',
        actionLabel: 'Open live',
        actionRoute: '/live',
      });
      return;
    }
    this.airMode.set(true);
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

    if (cue.shortcut && !/^F[1-9]$/.test(cue.shortcut)) {
      errors.shortcut = 'Shortcut must be between F1 and F9.';
    } else if (
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
    if (!cue.audioFile && cue.mode !== 'manual') return 'error';
    return 'ready';
  }

  // --------------------------------------------------------------- playback

  async playCue(cue: Cue): Promise<void> {
    const result = await this.audioEngine.play(cue);
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
    this.audioEngine.stop(playing.cueId);
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
    const result = await this.audioEngine.play(event.cue);
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

  /** Milliseconds left in a cue's cooldown, for the ARMED TRIGGERS countdown display. */
  cooldownRemainingMs(cueId: string): number {
    return this.triggerEngine.cooldownRemainingMs(this.cooldowns().get(cueId), this.now());
  }

  /** Most recent session event fired by this cue, for the "Last: HH:mm:ss" trigger list hint. */
  lastFiredAt(cueId: string): number | undefined {
    return this.events().find((item) => item.cueId === cueId)?.timestamp;
  }

  // ------------------------------------------------------------- detection

  processTranscript(transcript: TranscriptEvent): void {
    const pipelineStartedAt = performance.now();
    this.transcript.set(transcript);
    this.triggerEngine.log({
      stage: 'transcription-received',
      timestamp: transcript.timestamp,
      latencyMs: Math.max(0, Date.now() - transcript.timestamp),
      details: {
        isFinal: transcript.isFinal,
        textLength: transcript.text.length,
        segmentLength: (transcript.segmentText ?? transcript.text).length,
      },
    });
    if (!transcript.isFinal) {
      this.processInterimTranscript(transcript, pipelineStartedAt);
      return;
    }
    const detected = this.engine.processTranscript(transcript, this.cues());
    for (const event of detected) {
      const matchLatencyMs = performance.now() - pipelineStartedAt;
      this.triggerEngine.log({
        stage: 'keyword-matched',
        timestamp: event.timestamp,
        latencyMs: matchLatencyMs,
        cueId: event.cue.id,
        keyword: event.trigger.value,
      });
      const confidence = this.confidenceOf(transcript);
      const threshold = event.cue.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;
      const result = this.triggerEngine.evaluateConfidence(event, confidence, threshold);
      const level = result.level;
      const requiresConfirmation =
        event.action === 'confirm' || (event.action === 'play' && level === 'medium');
      this.detection.set({ event, confidence, level, requiresConfirmation });
      this.lastDetectionAt.set(this.now());
      if (!result.allowed) {
        this.triggerEngine.emitDecision({
          id: crypto.randomUUID(),
          timestamp: transcript.timestamp,
          state: 'matched',
          cueId: event.cue.id,
          cueName: event.cue.name,
          keyword: event.trigger.value,
          phrase: transcript.text,
          recognitionConfidence: confidence,
          latencyMs: matchLatencyMs,
          decision: 'rejected',
          reason: 'recognition-confidence-below-minimum',
          source: 'speech-recognition',
        });
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

      if (event.cue.cooldownMs > 0) {
        const expiresAt = this.now() + event.cue.cooldownMs;
        this.cooldowns.update((map) => new Map(map).set(event.cue.id, expiresAt));
      }

      if (requiresConfirmation) {
        this.triggerEngine.emitDecision({
          id: crypto.randomUUID(),
          timestamp: transcript.timestamp,
          state: 'matched',
          cueId: event.cue.id,
          cueName: event.cue.name,
          keyword: event.trigger.value,
          phrase: transcript.text,
          recognitionConfidence: confidence,
          latencyMs: matchLatencyMs,
          decision: 'pending',
          reason: 'operator-confirmation-required',
          source: 'speech-recognition',
        });
        this.queueConfirmation(event, confidence, level);
        continue;
      }

      if (event.action === 'play') {
        this.triggerEngine.emitDecision({
          id: crypto.randomUUID(),
          timestamp: transcript.timestamp,
          state: 'triggering',
          cueId: event.cue.id,
          cueName: event.cue.name,
          keyword: event.trigger.value,
          phrase: transcript.text,
          recognitionConfidence: confidence,
          latencyMs: matchLatencyMs,
          decision: 'accepted',
          reason: 'automatic-cue-accepted',
          source: 'speech-recognition',
        });
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

  private processInterimTranscript(transcript: TranscriptEvent, pipelineStartedAt: number): void {
    const detected = this.engine.processTranscript(transcript, this.cues(), {
      commitCooldown: false,
    });
    for (const event of detected) {
      if (event.action !== 'play') continue;
      const confidence = this.confidenceOf(transcript);
      const threshold = event.cue.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;
      if (confidence === undefined || confidence < threshold) continue;
      this.engine.markTriggered(event.cue.id, transcript.timestamp);
      this.handleAcceptedDetection(event, confidence, pipelineStartedAt);
    }
  }

  private handleAcceptedDetection(
    event: CueEvent,
    confidence: number,
    pipelineStartedAt: number,
  ): void {
    const matchLatencyMs = performance.now() - pipelineStartedAt;
    const level = this.triggerEngine.confidenceLevel(
      confidence,
      event.cue.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD,
    );
    this.detection.set({ event, confidence, level, requiresConfirmation: false });
    this.lastDetectionAt.set(this.now());
    if (event.cue.cooldownMs > 0) {
      this.cooldowns.update((map) =>
        new Map(map).set(event.cue.id, this.now() + event.cue.cooldownMs),
      );
    }
    this.triggerEngine.emitDecision({
      id: crypto.randomUUID(),
      timestamp: event.timestamp,
      state: 'triggering',
      cueId: event.cue.id,
      cueName: event.cue.name,
      keyword: event.trigger.value,
      phrase: event.transcript.text,
      recognitionConfidence: confidence,
      latencyMs: matchLatencyMs,
      decision: 'accepted',
      reason: 'automatic-cue-accepted-on-interim',
      source: 'speech-recognition',
    });
    void this.playDetected(event, confidence);
  }

  confidenceOf(transcript: TranscriptEvent): number | undefined {
    return Number.isFinite(transcript.confidence) && transcript.confidence > 0
      ? transcript.confidence
      : undefined;
  }

  dispose(): void {
    this.subscriptions.unsubscribe();
    if (this.clock !== undefined) clearInterval(this.clock);
    this.confirmationTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.confirmationTimeouts.clear();
    this.playedFlash.forEach((timeout) => clearTimeout(timeout));
    this.playedFlash.clear();
    this.stopListening();
    this.audioEngine.stopAll();
  }

  // ------------------------------------------------------------- internals

  private async playDetected(event: CueEvent, confidence?: number): Promise<void> {
    const startedAt = performance.now();
    const result = await this.audioEngine.play(event.cue);
    this.triggerEngine.log({
      stage: 'playback-completed',
      timestamp: Date.now(),
      latencyMs: performance.now() - startedAt,
      cueId: event.cue.id,
      keyword: event.trigger.value,
      details: { result },
    });
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
    this.preflightApproved.set(false);
    this.repository.save(cues);
  }
}
