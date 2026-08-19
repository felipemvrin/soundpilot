import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SettingsService } from '../../../core/services/settings.service';
import { PermissionStatus } from '../../../core/models/settings.model';

interface StatusItem {
  label: string;
  status: 'ok' | 'warning' | 'error' | 'neutral';
  message: string;
  action?: {
    label: string;
    callback: () => void;
  };
}

@Component({
  selector: 'app-system-status-section',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="settings-section" aria-label="System Status">
      <div class="section-header">
        <span class="eyebrow">System Status</span>
        <h2>Diagnostics & Health Check</h2>
      </div>

      <div class="status-grid">
        <div class="status-card">
          <span class="status-label">Application</span>
          <span [class]="'status-badge status-' + systemStatus().applicationReady ? 'ok' : 'error'">
            {{ systemStatus().applicationReady ? '● Ready' : '● Error' }}
          </span>
        </div>

        <div class="status-card">
          <span class="status-label">Audio Input</span>
          <span
            [class]="
              'status-badge status-' + (systemStatus().audioInputConnected ? 'ok' : 'warning')
            "
          >
            {{ systemStatus().audioInputConnected ? '● Connected' : '⚠ Not available' }}
          </span>
        </div>

        <div class="status-card">
          <span class="status-label">Audio Output</span>
          <span
            [class]="
              'status-badge status-' + (systemStatus().audioOutputConnected ? 'ok' : 'warning')
            "
          >
            {{ systemStatus().audioOutputConnected ? '● Connected' : '⚠ Not available' }}
          </span>
        </div>

        <div class="status-card">
          <span class="status-label">Microphone Permission</span>
          <span
            [class]="
              'status-badge status-' + getPermissionStatusClass(systemStatus().microphonePermission)
            "
          >
            {{ formatPermissionStatus(systemStatus().microphonePermission) }}
          </span>
        </div>

        <div class="status-card">
          <span class="status-label">Audio Permission</span>
          <span
            [class]="
              'status-badge status-' + getPermissionStatusClass(systemStatus().audioPermission)
            "
          >
            {{ formatPermissionStatus(systemStatus().audioPermission) }}
          </span>
        </div>

        <div class="status-card">
          <span class="status-label">Storage</span>
          <span
            [class]="'status-badge status-' + (systemStatus().storageAvailable ? 'ok' : 'error')"
          >
            {{ systemStatus().storageAvailable ? '● Available' : '● Unavailable' }}
          </span>
        </div>

        <div class="status-card">
          <span class="status-label">Backend / AI Engine</span>
          <span [class]="'status-badge status-neutral'">
            {{ systemStatus().backendConnected ? '● Connected' : '○ Not configured' }}
          </span>
          <span class="status-note">{{ systemStatus().backendStatus }}</span>
        </div>
      </div>

      <div class="status-legend">
        <div class="legend-item">
          <span class="legend-dot ok"></span>
          <span class="legend-text">Ready & Connected</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot warning"></span>
          <span class="legend-text">Not Available or Requires Action</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot error"></span>
          <span class="legend-text">Error or Unavailable</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot neutral"></span>
          <span class="legend-text">Not Configured or Coming Soon</span>
        </div>
      </div>

      <div class="status-actions">
        <button type="button" class="btn btn-secondary" (click)="refreshStatus()">
          Refresh Status
        </button>
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

      .status-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
        gap: 0.75rem;
      }

      .status-card {
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: var(--radius);
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .status-label {
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--muted);
      }

      .status-badge {
        font-size: 0.875rem;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 0.4rem;
      }

      .status-ok {
        color: var(--ok);
      }

      .status-warning {
        color: var(--warn);
      }

      .status-error {
        color: var(--danger);
      }

      .status-neutral {
        color: var(--muted);
      }

      .status-note {
        font-size: 0.75rem;
        color: var(--muted);
      }

      .status-legend {
        background: var(--surface-alt);
        border: 1px solid var(--line);
        border-radius: var(--radius);
        padding: 1rem;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
        gap: 1rem;
      }

      .legend-item {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      .legend-dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .legend-dot.ok {
        background: var(--ok);
      }

      .legend-dot.warning {
        background: var(--warn);
      }

      .legend-dot.error {
        background: var(--danger);
      }

      .legend-dot.neutral {
        background: var(--muted);
      }

      .legend-text {
        font-size: 0.8rem;
        color: var(--text);
      }

      .status-actions {
        display: flex;
        gap: 0.5rem;
      }

      .btn {
        padding: 0.5rem 1rem;
        background: var(--accent);
        color: var(--background);
        border: none;
        border-radius: var(--radius-sm);
        font-family: var(--mono);
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
      }

      .btn:hover {
        background: var(--ok);
      }

      .btn-secondary {
        background: var(--surface);
        color: var(--text);
        border: 1px solid var(--line);
      }

      .btn-secondary:hover {
        background: var(--surface-alt);
      }
    `,
  ],
})
export class SystemStatusSectionComponent {
  private readonly settings$ = inject(SettingsService);
  readonly systemStatus = this.settings$.systemStatus;

  getPermissionStatusClass(status: PermissionStatus): 'ok' | 'warning' | 'error' | 'neutral' {
    switch (status) {
      case 'granted':
        return 'ok';
      case 'denied':
        return 'error';
      case 'prompt':
        return 'warning';
      case 'not-available':
      default:
        return 'neutral';
    }
  }

  formatPermissionStatus(status: PermissionStatus): string {
    switch (status) {
      case 'granted':
        return '● Granted';
      case 'denied':
        return '✕ Denied';
      case 'prompt':
        return '⚠ Requires permission';
      case 'not-available':
      default:
        return '○ Not available';
    }
  }

  async refreshStatus(): Promise<void> {
    await this.settings$.enumerateDevices();
    await this.settings$.checkPermissions();
  }
}
