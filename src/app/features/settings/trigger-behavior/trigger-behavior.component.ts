import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { SettingsService } from '../../../core/services/settings.service';

@Component({
  selector: 'app-trigger-behavior-section',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="settings-section" aria-label="Trigger Behavior">
      <div class="section-header">
        <span class="eyebrow">Trigger Behavior</span>
        <h2>Detection & Matching Settings</h2>
      </div>

      <div class="config-grid">
        <div class="config-card">
          <label class="field">
            <div class="field-label">
              <span class="eyebrow">Technical diagnostics</span>
              <input
                type="checkbox"
                [checked]="settings().trigger.debugLogging"
                (change)="updateDebugLogging($any($event.target).checked)"
              />
            </div>
            <p class="field-hint">Log trigger stages, rejection reasons and pipeline latency.</p>
          </label>
        </div>

        <!-- SENSITIVITY -->
        <div class="config-card">
          <label class="field">
            <div class="field-label">
              <span class="eyebrow">Trigger Sensitivity</span>
              <span class="value">{{ Math.round(settings().trigger.sensitivity * 100) }}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              [value]="Math.round(settings().trigger.sensitivity * 100)"
              (input)="updateSensitivity($any($event.target).value)"
              class="slider"
            />
            <p class="field-hint">Reserved for future fuzzy matching tolerance</p>
          </label>
        </div>

        <!-- CONFIDENCE THRESHOLD -->
        <div class="config-card">
          <label class="field">
            <div class="field-label">
              <span class="eyebrow">Confidence Threshold</span>
              <span class="value"
                >{{ Math.round(settings().trigger.confidenceThreshold * 100) }}%</span
              >
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              [value]="Math.round(settings().trigger.confidenceThreshold * 100)"
              (input)="updateConfidenceThreshold($any($event.target).value)"
              class="slider"
            />
            <p class="field-hint">Minimum confidence to trigger a cue automatically</p>
          </label>
        </div>

        <!-- COOLDOWN -->
        <div class="config-card">
          <label class="field">
            <div class="field-label">
              <span class="eyebrow">Trigger Cooldown</span>
              <span class="value">{{ settings().trigger.cooldownMs }}ms</span>
            </div>
            <div class="cooldown-inputs">
              <input
                type="number"
                min="0"
                max="10000"
                step="100"
                [value]="settings().trigger.cooldownMs"
                (input)="updateCooldown($any($event.target).value)"
                class="input-number"
              />
              <select class="select-unit" (change)="updateCooldownUnit($any($event.target).value)">
                <option value="ms">ms</option>
                <option value="s">seconds</option>
              </select>
            </div>
            <p class="field-hint">Minimum time between trigger activations</p>
          </label>
        </div>
      </div>

      <div class="info-panel">
        <div class="info-header">
          <span class="icon">ℹ</span>
          <span class="title">Trigger Configuration</span>
        </div>
        <ul class="info-list">
          <li>
            <strong>Sensitivity:</strong> Reserved for future fuzzy matching tolerance; exact
            matching remains active today.
          </li>
          <li>
            <strong>Confidence:</strong> The minimum speech recognition confidence required to
            automatically play a cue (0.0 = any match, 1.0 = perfect match).
          </li>
          <li><strong>Cooldown:</strong> Prevents the same cue from triggering too frequently.</li>
        </ul>
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

      .value {
        font-size: 0.875rem;
        color: var(--accent);
        font-weight: 500;
      }

      .slider {
        width: 100%;
        height: 6px;
        border-radius: 3px;
        background: var(--line);
        outline: none;
        -webkit-appearance: none;
      }

      .slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: var(--accent);
        cursor: pointer;
        box-shadow: 0 0 4px rgba(117, 211, 198, 0.3);
      }

      .slider::-moz-range-thumb {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: var(--accent);
        cursor: pointer;
        border: none;
        box-shadow: 0 0 4px rgba(117, 211, 198, 0.3);
      }

      .field-hint {
        font-size: 0.75rem;
        color: var(--muted);
        margin: 0;
      }

      .cooldown-inputs {
        display: flex;
        gap: 0.5rem;
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
      }

      .select-unit {
        padding: 0.5rem;
        background: var(--surface-deep);
        border: 1px solid var(--line);
        border-radius: var(--radius-sm);
        color: var(--text);
        font-family: var(--mono);
        font-size: 0.875rem;
        cursor: pointer;
      }

      .input-number:focus,
      .select-unit:focus {
        outline: 2px solid var(--accent);
        outline-offset: 0;
      }

      .info-panel {
        background: var(--surface-alt);
        border-left: 3px solid var(--accent);
        border-radius: var(--radius);
        padding: 1rem;
      }

      .info-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.75rem;
      }

      .info-header .icon {
        font-size: 1.2rem;
        color: var(--accent);
      }

      .info-header .title {
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--text);
      }

      .info-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .info-list li {
        font-size: 0.8rem;
        color: var(--muted);
        line-height: 1.4;
      }

      .info-list strong {
        color: var(--text);
      }
    `,
  ],
})
export class TriggerBehaviorSectionComponent {
  private readonly settings$ = inject(SettingsService);
  readonly settings = this.settings$.settings;
  readonly Math = Math;

  updateSensitivity(value: string): void {
    this.settings$.updateTriggerSettings({
      sensitivity: Math.min(1, Math.max(0, Number(value) / 100)),
    });
  }

  updateDebugLogging(enabled: boolean): void {
    this.settings$.updateTriggerSettings({ debugLogging: enabled });
  }

  updateConfidenceThreshold(value: string): void {
    this.settings$.updateTriggerSettings({
      confidenceThreshold: Math.min(1, Math.max(0, Number(value) / 100)),
    });
  }

  updateCooldown(value: string): void {
    this.settings$.updateTriggerSettings({
      cooldownMs: Number(value),
    });
  }

  updateCooldownUnit(unit: string): void {
    const current = this.settings().trigger.cooldownMs;
    if (unit === 's') {
      this.settings$.updateTriggerSettings({
        cooldownMs: Math.round(current / 1000) * 1000,
      });
    }
  }
}
