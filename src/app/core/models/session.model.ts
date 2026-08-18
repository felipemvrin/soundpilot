import { ConfidenceLevel, Cue, CueEvent } from './cue.model';

export type SessionOutcome =
  'detected' | 'pending' | 'played' | 'ignored' | 'stopped' | 'expired' | 'error';

export interface SessionEvent {
  id: string;
  timestamp: number;
  cueId: string;
  cueName: string;
  trigger?: string;
  phrase?: string;
  confidence?: number;
  outcome: SessionOutcome;
  /** Short human explanation, e.g. "Low confidence" or "No audio file assigned". */
  detail?: string;
}

export interface CueDetection {
  event: CueEvent;
  confidence?: number;
  level: ConfidenceLevel;
  requiresConfirmation: boolean;
}

export interface PendingConfirmation {
  event: CueEvent;
  expiresAt: number;
  confidence?: number;
  level: ConfidenceLevel;
}

export interface OperationError {
  title: string;
  detail: string;
  actionLabel?: string;
  actionRoute?: string;
}

export interface PreflightCheck {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface PreflightReport {
  checks: PreflightCheck[];
  ready: boolean;
  timestamp: number;
}

export interface CueDraftPatch {
  name?: string;
  mode?: Cue['mode'];
  cooldownMs?: number;
  confidenceThreshold?: number;
  shortcut?: string;
  volume?: number;
}
