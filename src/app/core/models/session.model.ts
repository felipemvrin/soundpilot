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

export type PreflightCheckStatus = 'pass' | 'warning' | 'fail' | 'not-checked' | 'checking';
export type PreflightSeverity = 'info' | 'warning' | 'error';
export type PreflightStatus = 'ready' | 'ready-with-warnings' | 'attention-required';

export interface PreflightCheck {
  id: string;
  label: string;
  status: PreflightCheckStatus;
  severity: PreflightSeverity;
  message: string;
  details?: string[];
  actionLabel?: string;
  actionRoute?: string;
  actionId?: 'test-output';
}

export interface PreflightReport {
  checks: PreflightCheck[];
  status: PreflightStatus;
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
