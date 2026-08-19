import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SettingsService } from '../../../core/services/settings.service';
import { PermissionStatus } from '../../../core/models/settings.model';

@Component({
  selector: 'app-permissions-section',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="settings-section" aria-label="Permissions">
      <div class="section-header">
        <span class="eyebrow">Permissions</span>
        <h2>Browser & System Permissions</h2>
      </div>

      <div class="permissions-grid">
        <!-- MICROPHONE -->
        <div class="permission-card">
          <div class="permission-header">
            <span class="permission-name">Microphone Access</span>
            <span
              [class]="
                'permission-badge permission-' +
                getPermissionClass(settings().permissions.microphone)
              "
            >
              {{ getPermissionIcon(settings().permissions.microphone) }}
              {{ formatPermissionLabel(settings().permissions.microphone) }}
            </span>
          </div>
          <p class="permission-description">Required to listen to live audio for cue detection.</p>
          @if (settings().permissions.microphone === 'prompt') {
            <button type="button" class="btn btn-primary" (click)="requestMicrophonePermission()">
              Grant Permission
            </button>
          }
        </div>

        <!-- AUDIO INPUT -->
        <div class="permission-card">
          <div class="permission-header">
            <span class="permission-name">Audio Input</span>
            <span
              [class]="
                'permission-badge permission-' +
                getPermissionClass(settings().permissions.audioInput)
              "
            >
              {{ getPermissionIcon(settings().permissions.audioInput) }}
              {{ formatPermissionLabel(settings().permissions.audioInput) }}
            </span>
          </div>
          <p class="permission-description">Access to audio capture devices for live monitoring.</p>
        </div>

        <!-- NOTIFICATIONS -->
        <div class="permission-card">
          <div class="permission-header">
            <span class="permission-name">Notifications</span>
            <span
              [class]="
                'permission-badge permission-' +
                getPermissionClass(settings().permissions.notifications)
              "
            >
              {{ getPermissionIcon(settings().permissions.notifications) }}
              {{ formatPermissionLabel(settings().permissions.notifications) }}
            </span>
          </div>
          <p class="permission-description">
            Show notifications for cue events and system alerts (future feature).
          </p>
          @if (settings().permissions.notifications === 'prompt') {
            <button
              type="button"
              class="btn btn-primary"
              (click)="requestNotificationsPermission()"
            >
              Grant Permission
            </button>
          }
        </div>
      </div>

      <div class="permission-info">
        <div class="info-box">
          <span class="info-icon">ℹ</span>
          <div class="info-content">
            <p class="info-title">About Permissions</p>
            <ul class="info-list">
              <li><strong>Granted:</strong> SoundPilot has full access to this permission.</li>
              <li><strong>Requires permission:</strong> You will be prompted when needed.</li>
              <li><strong>Denied:</strong> Check your browser settings to grant permission.</li>
              <li><strong>Not available:</strong> Your browser doesn't support this API.</li>
            </ul>
          </div>
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

      .permissions-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
        gap: 1rem;
      }

      .permission-card {
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: var(--radius);
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .permission-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.5rem;
      }

      .permission-name {
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--text);
      }

      .permission-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.3rem 0.6rem;
        border-radius: var(--radius-sm);
        font-size: 0.75rem;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        white-space: nowrap;
      }

      .permission-granted {
        background: var(--ok);
        color: var(--background);
      }

      .permission-denied {
        background: var(--danger);
        color: var(--background);
      }

      .permission-prompt {
        background: var(--warn);
        color: var(--background);
      }

      .permission-not-available {
        background: var(--surface-alt);
        color: var(--muted);
      }

      .permission-description {
        font-size: 0.8rem;
        color: var(--muted);
        margin: 0;
        line-height: 1.4;
      }

      .btn {
        align-self: flex-start;
        padding: 0.4rem 0.8rem;
        background: var(--accent);
        color: var(--background);
        border: none;
        border-radius: var(--radius-sm);
        font-family: var(--mono);
        font-size: 0.75rem;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        cursor: pointer;
        transition: all 0.2s;
      }

      .btn:hover {
        background: var(--ok);
      }

      .btn-primary {
        background: var(--accent);
      }

      .permission-info {
        background: var(--surface-alt);
        border-left: 3px solid var(--accent);
        border-radius: var(--radius);
        padding: 1rem;
      }

      .info-box {
        display: flex;
        gap: 1rem;
      }

      .info-icon {
        font-size: 1.2rem;
        color: var(--accent);
        flex-shrink: 0;
      }

      .info-content {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .info-title {
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--text);
        margin: 0;
      }

      .info-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
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
export class PermissionsSectionComponent {
  private readonly settings$ = inject(SettingsService);
  readonly settings = this.settings$.settings;

  getPermissionClass(status: PermissionStatus): 'granted' | 'denied' | 'prompt' | 'not-available' {
    return status;
  }

  getPermissionIcon(status: PermissionStatus): string {
    switch (status) {
      case 'granted':
        return '●';
      case 'denied':
        return '✕';
      case 'prompt':
        return '⚠';
      case 'not-available':
      default:
        return '○';
    }
  }

  formatPermissionLabel(status: PermissionStatus): string {
    switch (status) {
      case 'granted':
        return 'Granted';
      case 'denied':
        return 'Denied';
      case 'prompt':
        return 'Prompt';
      case 'not-available':
      default:
        return 'Not Available';
    }
  }

  async requestMicrophonePermission(): Promise<void> {
    let stream: MediaStream | undefined;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      // Permission denied or unavailable - refresh the stored status below
    } finally {
      stream?.getTracks().forEach((track) => track.stop());
      await this.settings$.checkPermissions();
    }
  }

  async requestNotificationsPermission(): Promise<void> {
    if ('Notification' in window) {
      await Notification.requestPermission();
      await this.settings$.checkPermissions();
    }
  }
}
