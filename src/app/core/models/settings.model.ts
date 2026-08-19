/**
 * Settings model - Central configuration for SoundPilot.
 * Manages all device, audio, trigger and playback configurations.
 */

export type SampleRate = 44100 | 48000 | 96000;
export type ChannelConfig = 'mono' | 'stereo';
export type InputMode = 'microphone' | 'system-audio' | 'virtual-device';
export type PlaybackMode = 'one-shot' | 'restart' | 'ignore-while-playing';
export type QueueBehavior = 'replace' | 'queue' | 'ignore';
export type PermissionStatus = 'granted' | 'denied' | 'prompt' | 'not-available';

export interface AudioDevice {
  id: string;
  label: string;
  kind: 'audioinput' | 'audiooutput';
  state: 'connected' | 'unavailable' | 'unknown';
}

export interface AudioSettings {
  inputDevice: {
    id: string;
    label: string;
  } | null;
  outputDevice: {
    id: string;
    label: string;
  } | null;
  sampleRate: SampleRate;
  channels: ChannelConfig;
  inputMode: InputMode;
}

export interface MonitoringSettings {
  enabled: boolean;
  volume: number; // 0-1
}

export interface TriggerSettings {
  sensitivity: number; // 0-1
  confidenceThreshold: number; // 0-1
  cooldownMs: number; // milliseconds
}

export interface PlaybackSettings {
  mode: PlaybackMode;
  queueBehavior: QueueBehavior;
  fadeInMs: number;
  fadeOutMs: number;
}

export interface PermissionSettings {
  microphone: PermissionStatus;
  audioInput: PermissionStatus;
  notifications: PermissionStatus;
}

export interface SettingsConfig {
  audio: AudioSettings;
  monitoring: MonitoringSettings;
  trigger: TriggerSettings;
  playback: PlaybackSettings;
  permissions: PermissionSettings;
  version: number;
  lastModified: number;
}

/**
 * System status snapshot for diagnostics.
 */
export interface SystemStatusSnapshot {
  applicationReady: boolean;
  audioInputConnected: boolean;
  audioOutputConnected: boolean;
  microphonePermission: PermissionStatus;
  audioPermission: PermissionStatus;
  storageAvailable: boolean;
  backendConnected: boolean;
  backendStatus?: string;
}

export const DEFAULT_SETTINGS: SettingsConfig = {
  audio: {
    inputDevice: null,
    outputDevice: null,
    sampleRate: 48000,
    channels: 'stereo',
    inputMode: 'microphone',
  },
  monitoring: {
    enabled: false,
    volume: 0.8,
  },
  trigger: {
    sensitivity: 0.8,
    confidenceThreshold: 0.9,
    cooldownMs: 3000,
  },
  playback: {
    mode: 'one-shot',
    queueBehavior: 'replace',
    fadeInMs: 0,
    fadeOutMs: 100,
  },
  permissions: {
    microphone: 'not-available',
    audioInput: 'not-available',
    notifications: 'not-available',
  },
  version: 1,
  lastModified: Date.now(),
};

export const SETTINGS_STORAGE_KEY = 'soundpilot:settings:v1';
