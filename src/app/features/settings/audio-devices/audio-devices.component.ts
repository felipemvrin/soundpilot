import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { SettingsService } from '../../../core/services/settings.service';
import { AudioDevice } from '../../../core/models/settings.model';

@Component({
  selector: 'app-audio-devices-section',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="settings-section" aria-label="Audio Devices">
      <div class="section-header">
        <span class="eyebrow">Audio Devices</span>
        <h2>Input & Output Configuration</h2>
      </div>

      <div class="device-grid">
        <!-- INPUT DEVICE -->
        <div class="device-card">
          <div class="device-label">
            <span class="eyebrow">Input Device</span>
            <div class="device-status" [class.connected]="inputConnected()">
              <span class="status-dot"></span>
              {{ inputConnected() ? 'Connected' : 'Not available' }}
            </div>
          </div>

          @if (inputDevices().length > 0) {
            <select
              class="select-device"
              [value]="selectedInputId()"
              (change)="setInputDevice($any($event.target).value)"
            >
              <option value="" disabled>Select input device</option>
              @for (device of inputDevices(); track device.id) {
                <option [value]="device.id">{{ device.label }}</option>
              }
            </select>
            <div class="device-info">
              @if (selectedInputDevice(); as inputDevice) {
                <div class="info-row">
                  <span class="label">Device</span>
                  <span class="value">{{ inputDevice.label }}</span>
                </div>
                <div class="info-row">
                  <span class="label">Sample Rate</span>
                  <span class="value">{{ settings().audio.sampleRate }} Hz</span>
                </div>
                <div class="info-row">
                  <span class="label">Channels</span>
                  <span class="value">{{ formatChannels(settings().audio.channels) }}</span>
                </div>
              }
            </div>
          } @else {
            <div class="no-devices">
              <p class="muted">No input devices detected.</p>
              <button type="button" class="btn btn-sm" (click)="refreshDevices()">
                Refresh devices
              </button>
            </div>
          }
        </div>

        <!-- OUTPUT DEVICE -->
        <div class="device-card">
          <div class="device-label">
            <span class="eyebrow">Output Device</span>
            <div class="device-status" [class.connected]="outputConnected()">
              <span class="status-dot"></span>
              {{ outputConnected() ? 'Connected' : 'Not available' }}
            </div>
          </div>

          @if (outputDevices().length > 0) {
            <select
              class="select-device"
              [value]="selectedOutputId()"
              (change)="setOutputDevice($any($event.target).value)"
            >
              <option value="" disabled>Select output device</option>
              @for (device of outputDevices(); track device.id) {
                <option [value]="device.id">{{ device.label }}</option>
              }
            </select>
            <div class="device-info">
              @if (selectedOutputDevice(); as outputDevice) {
                <div class="info-row">
                  <span class="label">Device</span>
                  <span class="value">{{ outputDevice.label }}</span>
                </div>
                <div class="info-row">
                  <span class="label">Sample Rate</span>
                  <span class="value">{{ settings().audio.sampleRate }} Hz</span>
                </div>
                <div class="info-row">
                  <span class="label">Channels</span>
                  <span class="value">{{ formatChannels(settings().audio.channels) }}</span>
                </div>
              }
            </div>
          } @else {
            <div class="no-devices">
              <p class="muted">Output devices not listed by browser.</p>
            </div>
          }
        </div>
      </div>

      @if (enumerationError()) {
        <div class="error-message">
          <span class="icon">⚠</span>
          {{ enumerationError() }}
        </div>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .settings-section {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .section-header {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
      }

      h2 {
        font-size: 1rem;
        font-weight: 500;
        margin: 0;
        color: var(--text);
      }

      .eyebrow {
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--muted);
      }

      .device-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
        gap: 1rem;
      }

      .device-card {
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: var(--radius);
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .device-label {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
      }

      .device-status {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.875rem;
        color: var(--muted);
      }

      .device-status.connected {
        color: var(--ok);
      }

      .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--muted);
      }

      .device-status.connected .status-dot {
        background: var(--ok);
        animation: pulse 2s infinite;
      }

      @keyframes pulse {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.5;
        }
      }

      .select-device {
        padding: 0.5rem;
        background: var(--surface-deep);
        border: 1px solid var(--line);
        border-radius: var(--radius-sm);
        color: var(--text);
        font-family: var(--mono);
        font-size: 0.875rem;
        cursor: pointer;
      }

      .select-device:focus {
        outline: 2px solid var(--accent);
        outline-offset: 0;
      }

      .device-info {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        font-size: 0.75rem;
        padding-top: 0.5rem;
        border-top: 1px solid var(--line);
      }

      .info-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .info-row .label {
        color: var(--muted);
      }

      .info-row .value {
        color: var(--text);
        font-weight: 500;
      }

      .no-devices {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        align-items: flex-start;
      }

      .no-devices p {
        margin: 0;
        font-size: 0.875rem;
      }

      .btn-sm {
        padding: 0.35rem 0.7rem;
        font-size: 0.75rem;
      }

      .error-message {
        background: var(--surface-alt);
        border: 1px solid var(--danger);
        border-radius: var(--radius-sm);
        padding: 0.75rem;
        display: flex;
        gap: 0.5rem;
        align-items: flex-start;
        color: var(--danger);
        font-size: 0.875rem;
      }

      .error-message .icon {
        flex-shrink: 0;
        font-size: 1rem;
      }

      .muted {
        color: var(--muted);
        margin: 0;
      }
    `,
  ],
})
export class AudioDevicesSectionComponent {
  private readonly settings$ = inject(SettingsService);

  readonly settings = this.settings$.settings;
  readonly inputDevices = this.settings$.getInputDevices.bind(this.settings$);
  readonly outputDevices = this.settings$.getOutputDevices.bind(this.settings$);
  readonly enumerationError = this.settings$.enumerationError;

  readonly selectedInputId = computed(() => this.settings().audio.inputDevice?.id ?? '');
  readonly selectedOutputId = computed(() => this.settings().audio.outputDevice?.id ?? '');

  readonly selectedInputDevice = computed(() => {
    const id = this.selectedInputId();
    return this.inputDevices().find((d) => d.id === id);
  });

  readonly selectedOutputDevice = computed(() => {
    const id = this.selectedOutputId();
    return this.outputDevices().find((d) => d.id === id);
  });

  readonly inputConnected = computed(() => {
    return this.selectedInputDevice()?.state === 'connected';
  });

  readonly outputConnected = computed(() => {
    return this.selectedOutputDevice()?.state === 'connected';
  });

  setInputDevice(deviceId: string): void {
    const device = this.inputDevices().find((d) => d.id === deviceId);
    if (device) {
      this.settings$.updateAudioSettings({
        inputDevice: { id: device.id, label: device.label },
      });
    }
  }

  setOutputDevice(deviceId: string): void {
    const device = this.outputDevices().find((d) => d.id === deviceId);
    if (device) {
      this.settings$.updateAudioSettings({
        outputDevice: { id: device.id, label: device.label },
      });
    }
  }

  async refreshDevices(): Promise<void> {
    await this.settings$.enumerateDevices();
  }

  formatChannels(channels: string): string {
    return channels === 'mono' ? 'Mono' : 'Stereo';
  }
}
