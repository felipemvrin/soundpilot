import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { SettingsService } from '../../../core/services/settings.service';
import { SampleRate, ChannelConfig } from '../../../core/models/settings.model';

@Component({
  selector: 'app-audio-config-section',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="settings-section" aria-label="Audio Configuration">
      <div class="section-header">
        <span class="eyebrow">Audio Configuration</span>
        <h2>Technical Audio Settings</h2>
      </div>

      <div class="config-grid">
        <!-- SAMPLE RATE -->
        <div class="config-card">
          <label class="field">
            <div class="field-label">
              <span class="eyebrow">Sample Rate</span>
              <span class="badge badge-recommended">Recommended</span>
            </div>
            <select
              class="select-control"
              [value]="settings().audio.sampleRate"
              (change)="updateSampleRate($any($event.target).value)"
            >
              <option [value]="44100">44.1 kHz</option>
              <option [value]="48000" selected>48 kHz</option>
              <option [value]="96000">96 kHz</option>
            </select>
            <p class="field-hint">Professional broadcast standard</p>
          </label>
        </div>

        <!-- CHANNELS -->
        <div class="config-card">
          <label class="field">
            <div class="field-label">
              <span class="eyebrow">Channels</span>
            </div>
            <select
              class="select-control"
              [value]="settings().audio.channels"
              (change)="updateChannels($any($event.target).value)"
            >
              <option value="mono">Mono</option>
              <option value="stereo" selected>Stereo</option>
            </select>
            <p class="field-hint">Audio channel configuration</p>
          </label>
        </div>

        <!-- INPUT MODE -->
        <div class="config-card">
          <label class="field">
            <div class="field-label">
              <span class="eyebrow">Input Source</span>
            </div>
            <div class="radio-group">
              <label class="radio-option">
                <input
                  type="radio"
                  name="inputMode"
                  value="microphone"
                  [checked]="settings().audio.inputMode === 'microphone'"
                  (change)="updateInputMode('microphone')"
                />
                <span class="radio-label">Microphone / System Input</span>
              </label>
              <label class="radio-option disabled">
                <input type="radio" name="inputMode" value="system-audio" disabled />
                <span class="radio-label">System Audio</span>
                <span class="badge badge-coming-soon">Coming soon</span>
              </label>
              <label class="radio-option disabled">
                <input type="radio" name="inputMode" value="virtual-device" disabled />
                <span class="radio-label">Virtual Device</span>
                <span class="badge badge-coming-soon">Coming soon</span>
              </label>
            </div>
          </label>
        </div>
      </div>
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

      .config-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
        gap: 1rem;
      }

      .config-card {
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: var(--radius);
        padding: 1rem;
      }

      .field {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .field-label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        justify-content: space-between;
      }

      .select-control {
        padding: 0.5rem;
        background: var(--surface-deep);
        border: 1px solid var(--line);
        border-radius: var(--radius-sm);
        color: var(--text);
        font-family: var(--mono);
        font-size: 0.875rem;
        cursor: pointer;
      }

      .select-control:focus {
        outline: 2px solid var(--accent);
        outline-offset: 0;
      }

      .field-hint {
        font-size: 0.75rem;
        color: var(--muted);
        margin: 0;
      }

      .badge {
        display: inline-flex;
        align-items: center;
        padding: 0.2rem 0.5rem;
        border-radius: var(--radius-sm);
        font-size: 0.65rem;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .badge-recommended {
        background: var(--ok);
        color: var(--background);
      }

      .badge-coming-soon {
        background: var(--surface-alt);
        color: var(--muted);
      }

      .radio-group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .radio-option {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        cursor: pointer;
        opacity: 1;
        transition: opacity 0.2s;
      }

      .radio-option.disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .radio-option input[type='radio'] {
        width: 16px;
        height: 16px;
        cursor: pointer;
      }

      .radio-option.disabled input[type='radio'] {
        cursor: not-allowed;
      }

      .radio-label {
        flex: 1;
        font-size: 0.875rem;
        color: var(--text);
      }
    `,
  ],
})
export class AudioConfigSectionComponent {
  private readonly settings$ = inject(SettingsService);
  readonly settings = this.settings$.settings;

  updateSampleRate(rate: string): void {
    this.settings$.updateAudioSettings({
      sampleRate: Number(rate) as SampleRate,
    });
  }

  updateChannels(channels: string): void {
    this.settings$.updateAudioSettings({
      channels: channels as ChannelConfig,
    });
  }

  updateInputMode(mode: string): void {
    this.settings$.updateAudioSettings({
      inputMode: mode as 'microphone' | 'system-audio' | 'virtual-device',
    });
  }
}
