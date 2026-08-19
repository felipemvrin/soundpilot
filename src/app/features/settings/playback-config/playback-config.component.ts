import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { SettingsService } from '../../../core/services/settings.service';
import { PlaybackMode, QueueBehavior } from '../../../core/models/settings.model';

@Component({
  selector: 'app-playback-config-section',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="settings-section" aria-label="Cue Playback">
      <div class="section-header">
        <span class="eyebrow">Cue Playback</span>
        <h2>Audio Playback Behavior</h2>
      </div>

      <div class="config-grid">
        <!-- PLAYBACK MODE -->
        <div class="config-card">
          <label class="field">
            <div class="field-label">
              <span class="eyebrow">Playback Mode</span>
            </div>
            <select
              class="select-control"
              [value]="settings().playback.mode"
              (change)="updatePlaybackMode($any($event.target).value)"
            >
              <option value="one-shot">One Shot</option>
              <option value="restart">Restart</option>
              <option value="ignore-while-playing">Ignore While Playing</option>
            </select>
            <p class="field-hint">How cues respond when triggered while already playing</p>
          </label>
        </div>

        <!-- QUEUE BEHAVIOR -->
        <div class="config-card">
          <label class="field">
            <div class="field-label">
              <span class="eyebrow">Queue Behavior</span>
            </div>
            <select
              class="select-control"
              [value]="settings().playback.queueBehavior"
              (change)="updateQueueBehavior($any($event.target).value)"
            >
              <option value="replace">Replace Current Cue</option>
              <option value="queue">Queue Next Cue</option>
              <option value="ignore">Ignore New Trigger</option>
            </select>
            <p class="field-hint">What happens when a cue is triggered during playback</p>
          </label>
        </div>
      </div>

      <!-- FADES -->
      <div class="fades-section">
        <div class="fade-label">
          <span class="eyebrow">Fade In/Out</span>
          <span class="subtitle">Smooth audio transitions</span>
        </div>

        <div class="fade-grid">
          <label class="fade-control">
            <span class="fade-type">Fade In</span>
            <div class="fade-input-group">
              <input
                type="number"
                min="0"
                max="1000"
                step="10"
                [value]="settings().playback.fadeInMs"
                (input)="updateFadeIn($any($event.target).value)"
                class="input-number"
              />
              <span class="unit">ms</span>
            </div>
          </label>

          <label class="fade-control">
            <span class="fade-type">Fade Out</span>
            <div class="fade-input-group">
              <input
                type="number"
                min="0"
                max="1000"
                step="10"
                [value]="settings().playback.fadeOutMs"
                (input)="updateFadeOut($any($event.target).value)"
                class="input-number"
              />
              <span class="unit">ms</span>
            </div>
          </label>
        </div>
      </div>

      <div class="mode-info">
        <div class="mode-explanation">
          <span class="mode-name">{{ getPlaybackModeLabel(settings().playback.mode) }}</span>
          <span class="mode-description">{{
            getPlaybackModeDescription(settings().playback.mode)
          }}</span>
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
        justify-content: space-between;
        align-items: center;
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

      .fades-section {
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: var(--radius);
        padding: 1rem;
      }

      .fade-label {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        margin-bottom: 1rem;
      }

      .subtitle {
        font-size: 0.875rem;
        color: var(--muted);
        font-weight: 400;
      }

      .fade-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
        gap: 1rem;
      }

      .fade-control {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .fade-type {
        font-size: 0.875rem;
        color: var(--text);
        font-weight: 500;
      }

      .fade-input-group {
        display: flex;
        gap: 0.5rem;
        align-items: center;
      }

      .input-number {
        flex: 1;
        padding: 0.5rem;
        background: var(--surface-deep);
        border: 1px solid var(--line);
        border-radius: var(--radius-sm);
        color: var(--text);
        font-family: var(--mono);
        font-size: 0.875rem;
        text-align: right;
      }

      .input-number:focus {
        outline: 2px solid var(--accent);
        outline-offset: 0;
      }

      .unit {
        font-size: 0.75rem;
        color: var(--muted);
        flex-shrink: 0;
      }

      .mode-info {
        background: var(--surface-alt);
        border-left: 3px solid var(--accent);
        border-radius: var(--radius);
        padding: 1rem;
      }

      .mode-explanation {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
      }

      .mode-name {
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--accent);
      }

      .mode-description {
        font-size: 0.8rem;
        color: var(--muted);
        line-height: 1.4;
      }
    `,
  ],
})
export class PlaybackConfigSectionComponent {
  private readonly settings$ = inject(SettingsService);
  readonly settings = this.settings$.settings;

  updatePlaybackMode(mode: string): void {
    this.settings$.updatePlaybackSettings({
      mode: mode as PlaybackMode,
    });
  }

  updateQueueBehavior(behavior: string): void {
    this.settings$.updatePlaybackSettings({
      queueBehavior: behavior as QueueBehavior,
    });
  }

  updateFadeIn(value: string): void {
    this.settings$.updatePlaybackSettings({
      fadeInMs: Number(value),
    });
  }

  updateFadeOut(value: string): void {
    this.settings$.updatePlaybackSettings({
      fadeOutMs: Number(value),
    });
  }

  getPlaybackModeLabel(mode: PlaybackMode): string {
    const labels: Record<PlaybackMode, string> = {
      'one-shot': 'One Shot',
      restart: 'Restart',
      'ignore-while-playing': 'Ignore While Playing',
    };
    return labels[mode];
  }

  getPlaybackModeDescription(mode: PlaybackMode): string {
    const descriptions: Record<PlaybackMode, string> = {
      'one-shot': 'Play the cue once. Do not restart if triggered again.',
      restart: 'Restart the cue from the beginning if triggered during playback.',
      'ignore-while-playing': 'Ignore new triggers while a cue is already playing.',
    };
    return descriptions[mode];
  }
}
