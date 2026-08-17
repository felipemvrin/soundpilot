export type CueMode = 'automatic' | 'confirm' | 'manual';
export type CuePriority = 'low' | 'normal' | 'high';
export type CueStatus = 'idle' | 'detected' | 'played' | 'cooldown';
export type CueAction = 'play' | 'confirm' | 'display';

export interface CueTrigger {
  id: string;
  value: string;
}

export interface Cue {
  id: string;
  name: string;
  triggers: CueTrigger[];
  audioFile: string;
  mode: CueMode;
  enabled: boolean;
  cooldownMs: number;
  volume: number;
  priority: CuePriority;
}

export interface TranscriptEvent {
  text: string;
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
  type: 'played' | 'stopped' | 'error';
  timestamp: number;
}
