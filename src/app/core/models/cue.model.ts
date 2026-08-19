export type CueMode = 'automatic' | 'confirm' | 'manual';
export type CuePriority = 'low' | 'normal' | 'high';
export type CueStatus = 'idle' | 'detected' | 'played' | 'cooldown';
export type CueAction = 'play' | 'confirm' | 'display';

/** Operational status shown for a cue in the LIVE view. */
export type CueRuntimeStatus = 'ready' | 'disabled' | 'playing' | 'played' | 'pending' | 'error';

/** Global system status shown in the header. */
export type SystemStatus = 'ready' | 'listening' | 'processing' | 'playing' | 'paused' | 'error';

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'unknown';

export interface CueTrigger {
  id: string;
  value: string;
}

export interface Cue {
  id: string;
  name: string;
  triggers: CueTrigger[];
  audioFile: string;
  audioName?: string;
  mode: CueMode;
  enabled: boolean;
  cooldownMs: number;
  volume: number;
  priority: CuePriority;
  /** Minimum recognition confidence (0-1) required to fire automatically. */
  confidenceThreshold?: number;
  /** Manual keyboard shortcut, e.g. "F1". */
  shortcut?: string;
}

export interface TranscriptEvent {
  text: string;
  /** New recognition segment used for trigger matching while `text` may be cumulative. */
  segmentText?: string;
  confidence: number;
  timestamp: number;
  isFinal: boolean;
}

export interface CueEvent {
  cue: Cue;
  trigger: CueTrigger;
  action: CueAction;
  transcript: TranscriptEvent;
  timestamp: number;
}

export interface AudioPlaybackEvent {
  cueId: string;
  type: 'played' | 'stopped' | 'error' | 'ended';
  timestamp: number;
  error?: string;
}

export interface NowPlaying {
  cueId: string;
  cueName: string;
  audioFile: string;
  startedAt: number;
}
