import { ConfidenceLevel, Cue, CueEvent, CueTrigger } from './cue.model';

/**
 * Domain vocabulary for the Trigger Engine. A `Trigger` is a `Cue` configured to react to live
 * speech; its `Keyword`s are the trigger phrases. These are intentionally type aliases (not new
 * shapes) so the engine reuses the existing `Cue` model instead of duplicating storage/validation.
 */
export type Trigger = Cue;
export type Keyword = CueTrigger;
/** A confirmed keyword match against a transcript, ready for confidence evaluation. */
export type Match = CueEvent;

/**
 * Lifecycle of the Trigger Engine, surfaced directly in the UI so an operator can tell in under a
 * second whether SoundPilot is listening, has matched something, or is on cooldown.
 */
export type TriggerState =
  | 'idle'
  | 'initializing'
  | 'listening'
  | 'detecting'
  | 'matched'
  | 'triggering'
  | 'cooldown'
  | 'paused'
  | 'error';

/** Outcome of evaluating a keyword match against its confidence threshold. */
export interface DetectionResult {
  match: Match;
  confidence?: number;
  level: ConfidenceLevel;
  /** Whether the engine allows this match to proceed (fails only on low-confidence automatic cues). */
  allowed: boolean;
}

/** Snapshot of session signals used to derive the current `TriggerState`, in priority order. */
export interface TriggerEngineSnapshot {
  error: boolean;
  triggering: boolean;
  matched: boolean;
  cooldownActive: boolean;
  detecting: boolean;
  initializing: boolean;
  listening: boolean;
  paused: boolean;
}

/** A single trigger-engine occurrence, used to feed the activity feed / diagnostics. */
export interface TriggerEvent {
  id: string;
  timestamp: number;
  state: TriggerState;
  cueId?: string;
  cueName?: string;
  keyword?: string;
  phrase?: string;
  recognitionConfidence?: number;
  matchConfidence?: number;
  decision?: 'accepted' | 'rejected' | 'pending';
  reason?: string;
  source?: 'speech-recognition' | 'manual';
  latencyMs?: number;
}

export type TriggerDiagnosticStage =
  | 'input-received'
  | 'transcription-received'
  | 'keyword-matched'
  | 'decision-accepted'
  | 'decision-rejected'
  | 'decision-pending'
  | 'playback-completed';

export interface TriggerDiagnosticEvent {
  stage: TriggerDiagnosticStage;
  timestamp: number;
  latencyMs?: number;
  cueId?: string;
  keyword?: string;
  reason?: string;
  details?: Readonly<Record<string, string | number | boolean>>;
}
