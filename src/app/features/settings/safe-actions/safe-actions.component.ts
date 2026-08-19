import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SettingsService } from '../../../core/services/settings.service';

@Component({
  selector: 'app-safe-actions-section',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="settings-section danger-zone" aria-label="Safe Actions">
      <div class="section-header">
        <span class="eyebrow">Danger Zone</span>
        <h2>Reset & Advanced Actions</h2>
      </div>

      <div class="action-card danger">
        <div class="action-header">
          <span class="action-title">Reset Audio Configuration</span>
          <span class="action-description"> Reset only audio device settings to defaults. </span>
        </div>
        @if (!showConfirmReset()) {
          <button type="button" class="btn btn-danger" (click)="confirmResetAudio()">
            Reset Audio Settings
          </button>
        } @else {
          <div class="confirmation">
            <p class="confirmation-message">Are you sure? This action cannot be undone.</p>
            <div class="confirmation-actions">
              <button type="button" class="btn btn-danger-confirm" (click)="resetAudio()">
                Yes, Reset Audio
              </button>
              <button type="button" class="btn btn-cancel" (click)="cancelReset()">Cancel</button>
            </div>
          </div>
        }
      </div>

      <div class="action-card danger">
        <div class="action-header">
          <span class="action-title">Reset All Settings</span>
          <span class="action-description">
            Reset all configuration to factory defaults. This includes devices, audio settings,
            triggers, playback, and permissions.
          </span>
        </div>
        @if (!showConfirmResetAll()) {
          <button type="button" class="btn btn-danger" (click)="confirmResetAll()">
            Reset All Settings
          </button>
        } @else {
          <div class="confirmation">
            <p class="confirmation-message">
              ⚠ This will reset <strong>ALL</strong> your settings to defaults. This action cannot
              be undone.
            </p>
            <div class="confirmation-actions">
              <button type="button" class="btn btn-danger-confirm" (click)="resetAll()">
                Yes, Reset Everything
              </button>
              <button type="button" class="btn btn-cancel" (click)="cancelReset()">Cancel</button>
            </div>
          </div>
        }
      </div>

      <div class="warning-box">
        <span class="warning-icon">⚠</span>
        <div class="warning-content">
          <p class="warning-title">Careful with these actions</p>
          <ul class="warning-list">
            <li>Reset actions cannot be undone.</li>
            <li>You will need to reconfigure SoundPilot after a reset.</li>
            <li>Your cue library and recordings will not be affected.</li>
          </ul>
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

      .danger-zone {
        border-top: 2px solid var(--danger);
        padding-top: 1.5rem;
      }

      .action-card {
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: var(--radius);
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .action-card.danger {
        border-color: var(--danger);
        border-left: 3px solid var(--danger);
      }

      .action-header {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
      }

      .action-title {
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--danger);
      }

      .action-description {
        font-size: 0.8rem;
        color: var(--muted);
        line-height: 1.4;
      }

      .btn {
        align-self: flex-start;
        padding: 0.5rem 1rem;
        background: var(--accent);
        color: var(--background);
        border: none;
        border-radius: var(--radius-sm);
        font-family: var(--mono);
        font-size: 0.875rem;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        cursor: pointer;
        transition: all 0.2s;
      }

      .btn:hover {
        transform: translateY(-1px);
      }

      .btn-danger {
        background: var(--danger);
        color: var(--background);
      }

      .btn-danger:hover {
        background: #ff5555;
      }

      .btn-danger-confirm {
        background: var(--danger);
        color: var(--background);
        flex: 1;
      }

      .btn-cancel {
        background: var(--surface-alt);
        color: var(--text);
        border: 1px solid var(--line);
        flex: 1;
      }

      .btn-cancel:hover {
        background: var(--line);
      }

      .confirmation {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        background: var(--surface-deep);
        border: 1px solid var(--danger);
        border-radius: var(--radius-sm);
        padding: 1rem;
      }

      .confirmation-message {
        font-size: 0.875rem;
        color: var(--text);
        margin: 0;
        line-height: 1.4;
      }

      .confirmation-message strong {
        color: var(--danger);
      }

      .confirmation-actions {
        display: flex;
        gap: 0.5rem;
      }

      .warning-box {
        background: var(--surface-alt);
        border-left: 3px solid var(--warn);
        border-radius: var(--radius);
        padding: 1rem;
        display: flex;
        gap: 1rem;
      }

      .warning-icon {
        font-size: 1.2rem;
        color: var(--warn);
        flex-shrink: 0;
      }

      .warning-content {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .warning-title {
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--text);
        margin: 0;
      }

      .warning-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
      }

      .warning-list li {
        font-size: 0.8rem;
        color: var(--muted);
        line-height: 1.4;
      }
    `,
  ],
})
export class SafeActionsSectionComponent {
  private readonly settings$ = inject(SettingsService);

  readonly showConfirmReset = signal(false);
  readonly showConfirmResetAll = signal(false);

  confirmResetAudio(): void {
    this.showConfirmReset.set(true);
    this.showConfirmResetAll.set(false);
  }

  confirmResetAll(): void {
    this.showConfirmResetAll.set(true);
    this.showConfirmReset.set(false);
  }

  cancelReset(): void {
    this.showConfirmReset.set(false);
    this.showConfirmResetAll.set(false);
  }

  resetAudio(): void {
    this.settings$.updateAudioSettings({
      inputDevice: null,
      outputDevice: null,
      sampleRate: 48000,
      channels: 'stereo',
      inputMode: 'microphone',
    });
    this.showConfirmReset.set(false);
  }

  resetAll(): void {
    this.settings$.resetToDefaults();
    this.showConfirmResetAll.set(false);
  }
}
