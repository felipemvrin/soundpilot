import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { MicrophoneService } from '../../core/audio/microphone.service';
import { SpeechRecognitionService } from '../../core/speech/speech-recognition.service';
import { LiveSessionService } from '../../core/services/live-session.service';
import { AudioLevelMeterComponent } from '../../shared/components/audio-level-meter/audio-level-meter.component';

interface DeviceInfo {
  id: string;
  label: string;
}

const LANGUAGES = [
  { value: 'es-ES', label: 'Español (España)' },
  { value: 'es-419', label: 'Español (Latinoamérica)' },
  { value: 'es-AR', label: 'Español (Argentina)' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'pt-BR', label: 'Português (Brasil)' },
];

@Component({
  selector: 'app-settings',
  imports: [RouterLink, AudioLevelMeterComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  readonly session = inject(LiveSessionService);
  readonly microphone = inject(MicrophoneService);
  readonly speech = inject(SpeechRecognitionService);

  readonly languages = LANGUAGES;
  readonly inputs = signal<DeviceInfo[]>([]);
  readonly outputs = signal<DeviceInfo[]>([]);
  readonly devicesError = signal<string | undefined>(undefined);
  readonly volumePercent = computed(() => Math.round(this.session.masterVolume() * 100));

  constructor() {
    void this.refreshDevices();
  }

  async refreshDevices(): Promise<void> {
    if (!navigator.mediaDevices?.enumerateDevices) {
      this.devicesError.set('This browser does not expose the device list.');
      return;
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.inputs.set(this.map(devices, 'audioinput'));
      this.outputs.set(this.map(devices, 'audiooutput'));
      this.devicesError.set(undefined);
    } catch {
      this.devicesError.set('Device list unavailable. Grant microphone permission and retry.');
    }
  }

  setLanguage(value: string): void {
    this.speech.language.set(value);
    if (this.speech.isRecognizing()) {
      this.speech.stop();
      this.speech.start();
    }
  }

  setVolume(value: string): void {
    this.session.setMasterVolume(Math.min(1, Math.max(0, Number(value) / 100)));
  }

  private map(devices: MediaDeviceInfo[], kind: MediaDeviceKind): DeviceInfo[] {
    return devices
      .filter((device) => device.kind === kind)
      .map((device, index) => ({
        id: device.deviceId || `${kind}-${index}`,
        label: device.label || `${kind === 'audioinput' ? 'Input' : 'Output'} ${index + 1}`,
      }));
  }
}
