import { Injectable, effect, signal } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

import {
  AudioDevice,
  ChannelConfig,
  DEFAULT_SETTINGS,
  InputMode,
  PlaybackMode,
  PermissionStatus,
  PermissionSettings,
  QueueBehavior,
  SampleRate,
  SETTINGS_STORAGE_KEY,
  SettingsConfig,
  SystemStatusSnapshot,
} from '../models/settings.model';

type PermissionStatusObject = globalThis.PermissionStatus;

/**
 * Centralized settings management service.
 * Handles configuration persistence, device enumeration, and permission checks.
 * Uses signals for reactive updates throughout the app.
 */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly storageSubject = new BehaviorSubject<SettingsConfig>(this.loadFromStorage());
  private readonly devicesSubject = new BehaviorSubject<AudioDevice[]>([]);
  private readonly watchedPermissions = new WeakSet<PermissionStatusObject>();

  readonly settings = signal<SettingsConfig>(this.loadFromStorage());
  readonly audioDevices = signal<AudioDevice[]>([]);
  readonly enumerationError = signal<string | undefined>(undefined);
  readonly systemStatus = signal<SystemStatusSnapshot>(this.getSystemStatus());

  readonly settings$ = this.storageSubject.asObservable();
  readonly devices$ = this.devicesSubject.asObservable();

  constructor() {
    // Auto-save on changes
    effect(
      () => {
        const config = this.settings();
        this.saveToStorage(config);
        this.storageSubject.next(config);
      },
      { allowSignalWrites: true },
    );

    // Update system status when settings change
    effect(() => {
      this.settings();
      this.systemStatus.set(this.getSystemStatus());
    });

    // Enumerate devices on initialization
    void this.enumerateDevices();
    void this.checkPermissions();
    navigator.mediaDevices?.addEventListener?.('devicechange', () => {
      void this.enumerateDevices();
    });
  }

  /**
   * Enumerate available audio devices.
   */
  async enumerateDevices(): Promise<void> {
    if (!navigator.mediaDevices?.enumerateDevices) {
      this.enumerationError.set('Device enumeration not supported by this browser.');
      return;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioDevices: AudioDevice[] = devices
        .filter(
          (d): d is MediaDeviceInfo & { kind: 'audioinput' | 'audiooutput' } =>
            d.kind === 'audioinput' || d.kind === 'audiooutput',
        )
        .map((d, index) => ({
          id: d.deviceId || `${d.kind}-${index}`,
          label: d.label || this.getDefaultDeviceLabel(d.kind, index),
          kind: d.kind,
          state: this.getDeviceState(d),
        }));

      this.audioDevices.set(audioDevices);
      this.devicesSubject.next(audioDevices);
      this.enumerationError.set(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to enumerate devices';
      this.enumerationError.set(message);
    }
  }

  /**
   * Update audio settings.
   */
  updateAudioSettings(partial: Partial<SettingsConfig['audio']>): void {
    const current = this.settings();
    this.settings.set({
      ...current,
      audio: { ...current.audio, ...partial },
      lastModified: Date.now(),
    });
  }

  /**
   * Update trigger settings.
   */
  updateTriggerSettings(partial: Partial<SettingsConfig['trigger']>): void {
    const current = this.settings();
    this.settings.set({
      ...current,
      trigger: { ...current.trigger, ...partial },
      lastModified: Date.now(),
    });
  }

  /**
   * Update playback settings.
   */
  updatePlaybackSettings(partial: Partial<SettingsConfig['playback']>): void {
    const current = this.settings();
    this.settings.set({
      ...current,
      playback: { ...current.playback, ...partial },
      lastModified: Date.now(),
    });
  }

  /**
   * Update monitoring settings.
   */
  updateMonitoringSettings(partial: Partial<SettingsConfig['monitoring']>): void {
    const current = this.settings();
    this.settings.set({
      ...current,
      monitoring: { ...current.monitoring, ...partial },
      lastModified: Date.now(),
    });
  }

  /**
   * Check and update permission status.
   */
  async checkPermissions(): Promise<void> {
    const permissions = await this.queryPermissions();
    const current = this.settings();
    this.settings.set({
      ...current,
      permissions,
      lastModified: Date.now(),
    });
  }

  /**
   * Reset all settings to defaults.
   */
  resetToDefaults(): void {
    this.settings.set({
      ...DEFAULT_SETTINGS,
      lastModified: Date.now(),
    });
  }

  /**
   * Get input devices only.
   */
  getInputDevices(): AudioDevice[] {
    return this.audioDevices().filter((d) => d.kind === 'audioinput');
  }

  /**
   * Get output devices only.
   */
  getOutputDevices(): AudioDevice[] {
    return this.audioDevices().filter((d) => d.kind === 'audiooutput');
  }

  /**
   * Verify if a device exists and is available.
   */
  isDeviceAvailable(deviceId: string, kind: 'audioinput' | 'audiooutput'): boolean {
    return this.audioDevices().some((d) => d.id === deviceId && d.kind === kind);
  }

  /**
   * Get system diagnostics snapshot.
   */
  private getSystemStatus(): SystemStatusSnapshot {
    const devices = this.audioDevices();
    const settings = this.settings();

    return {
      applicationReady: true,
      audioInputConnected: devices.some((d) => d.kind === 'audioinput' && d.state === 'connected'),
      audioOutputConnected: devices.some(
        (d) => d.kind === 'audiooutput' && d.state === 'connected',
      ),
      microphonePermission: settings.permissions.microphone,
      audioPermission: settings.permissions.audioInput,
      storageAvailable: this.isStorageAvailable(),
      backendConnected: false, // Placeholder for future
      backendStatus: 'not-configured',
    };
  }

  /**
   * Load settings from localStorage.
   */
  private loadFromStorage(): SettingsConfig {
    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as SettingsConfig;
        return { ...DEFAULT_SETTINGS, ...parsed, version: 1 };
      }
    } catch {
      // Storage error - continue with defaults
    }
    return DEFAULT_SETTINGS;
  }

  /**
   * Save settings to localStorage.
   */
  private saveToStorage(config: SettingsConfig): void {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(config));
    } catch {
      // Storage quota exceeded or unavailable
      console.warn('Failed to save settings to localStorage');
    }
  }

  /**
   * Check if localStorage is available.
   */
  private isStorageAvailable(): boolean {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Query browser permissions API.
   */
  private async queryPermissions(): Promise<PermissionSettings> {
    const [microphone, notifications] = await Promise.all([
      this.checkPermission('microphone'),
      this.checkPermission('notifications'),
    ]);
    return {
      microphone,
      audioInput: microphone,
      notifications,
    };
  }

  /**
   * Check individual permission.
   */
  private async checkPermission(name: PermissionName): Promise<PermissionStatus> {
    if (!navigator.permissions?.query) {
      return this.fallbackPermissionStatus(name);
    }

    try {
      const result = await navigator.permissions.query({ name });
      if (!this.watchedPermissions.has(result)) {
        this.watchedPermissions.add(result);
        result.addEventListener?.('change', () => void this.checkPermissions());
      }
      return this.mapPermissionState(result.state);
    } catch {
      return this.fallbackPermissionStatus(name);
    }
  }

  private fallbackPermissionStatus(name: PermissionName): PermissionStatus {
    if (name === 'microphone') {
      return typeof navigator.mediaDevices?.getUserMedia === 'function'
        ? 'prompt'
        : 'not-available';
    }
    if (name === 'notifications' && typeof Notification !== 'undefined') {
      return this.mapPermissionState(Notification.permission);
    }
    return 'not-available';
  }

  private mapPermissionState(
    state: PermissionState | NotificationPermission | undefined,
  ): PermissionStatus {
    switch (state) {
      case 'granted':
        return 'granted';
      case 'denied':
        return 'denied';
      case 'prompt':
      case 'default':
        return 'prompt';
      default:
        return 'not-available';
    }
  }

  /**
   * Determine device state based on label availability.
   */
  private getDeviceState(device: MediaDeviceInfo): 'connected' | 'unavailable' | 'unknown' {
    if (device.label) {
      return 'connected';
    }
    if (device.deviceId) {
      return 'unknown';
    }
    return 'unavailable';
  }

  /**
   * Generate default device label.
   */
  private getDefaultDeviceLabel(kind: MediaDeviceKind, index: number): string {
    if (kind === 'audioinput') {
      return index === 0 ? 'Default Input' : `Input ${index + 1}`;
    }
    return index === 0 ? 'Default Output' : `Output ${index + 1}`;
  }
}
