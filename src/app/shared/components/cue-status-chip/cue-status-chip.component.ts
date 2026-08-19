import { DatePipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';

import { Cue, CueRuntimeStatus } from '../../../core/models/cue.model';

const STATUS_LABEL: Record<CueRuntimeStatus, string> = {
  ready: 'ARMED',
  disabled: 'DISABLED',
  playing: 'PLAYING',
  played: 'PLAYED',
  pending: 'CONFIRM',
  error: 'NO AUDIO',
};

const STATUS_GLYPH: Record<CueRuntimeStatus, string> = {
  ready: '●',
  disabled: '○',
  playing: '▶',
  played: '✓',
  pending: '?',
  error: '⚠',
};

@Component({
  selector: 'app-cue-status-chip',
  imports: [DatePipe],
  template: `
    <button
      type="button"
      class="chip"
      [class]="'chip status-' + status()"
      [class.cooling-down]="cooldownRemainingMs() > 0"
      [disabled]="status() === 'disabled'"
      [attr.aria-label]="ariaLabel()"
      (click)="fire.emit(cue())"
    >
      <span class="name">{{ cue().name }}</span>
      <span class="triggers">{{ triggerLabel() }}</span>
      <span class="status">
        @if (cooldownRemainingMs() > 0) {
          <span aria-hidden="true">◷</span> COOLDOWN
          {{ (cooldownRemainingMs() / 1000).toFixed(1) }}s
        } @else {
          <span aria-hidden="true">{{ glyph() }}</span> {{ label() }}
        }
      </span>
      <span class="meta">
        <span class="kbd">{{ cue().shortcut ?? '—' }}</span>
        @if (lastFiredAt(); as last) {
          <span class="last">Last {{ last | date: 'HH:mm:ss' }}</span>
        }
      </span>
    </button>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .chip {
        background: var(--surface-alt);
        border: 1px solid var(--line-strong);
        border-left: 3px solid var(--line-strong);
        border-radius: var(--radius-sm);
        color: var(--text);
        cursor: pointer;
        display: grid;
        font: inherit;
        gap: 0.3rem;
        justify-items: start;
        padding: 0.6rem 0.7rem;
        text-align: left;
        width: 100%;
      }
      .chip:hover:not(:disabled) {
        border-color: var(--accent);
      }
      .name {
        font-size: 0.95rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 100%;
      }
      .status {
        color: var(--muted);
        font-size: 0.68rem;
        font-weight: 700;
        letter-spacing: 0.08em;
      }
      .triggers {
        color: var(--muted);
        font-size: 0.7rem;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .meta {
        align-items: center;
        display: flex;
        gap: 0.6rem;
        justify-content: space-between;
        width: 100%;
      }
      .last {
        color: var(--muted);
        font-size: 0.66rem;
      }
      .chip.cooling-down {
        border-left-color: var(--warn);
      }
      .chip.cooling-down .status {
        color: var(--warn);
      }
      .status-ready {
        border-left-color: var(--ok);
      }
      .status-ready .status {
        color: var(--ok-soft);
      }
      .status-playing {
        border-left-color: var(--accent);
      }
      .status-playing .status {
        color: var(--accent);
      }
      .status-played {
        border-left-color: var(--ok);
      }
      .status-played .status {
        color: var(--ok-soft);
      }
      .status-pending {
        border-left-color: var(--warn);
      }
      .status-pending .status {
        color: var(--warn);
      }
      .status-error {
        border-left-color: var(--danger);
      }
      .status-error .status {
        color: var(--danger);
      }
      .status-disabled {
        cursor: not-allowed;
        opacity: 0.55;
      }
    `,
  ],
})
export class CueStatusChipComponent {
  readonly cue = input.required<Cue>();
  readonly status = input<CueRuntimeStatus>('ready');
  /** Milliseconds left in cooldown; when > 0 the chip shows a countdown instead of its status. */
  readonly cooldownRemainingMs = input(0);
  readonly lastFiredAt = input<number | undefined>(undefined);
  readonly fire = output<Cue>();

  readonly label = computed(() => STATUS_LABEL[this.status()]);
  readonly glyph = computed(() => STATUS_GLYPH[this.status()]);
  readonly triggerLabel = computed(
    () =>
      this.cue()
        .triggers.map((trigger) => `"${trigger.value}"`)
        .join(' · ') || 'No triggers',
  );
  readonly ariaLabel = computed(
    () =>
      `Play cue ${this.cue().name}, status ${STATUS_LABEL[this.status()]}` +
      (this.cue().shortcut ? `, shortcut ${this.cue().shortcut}` : ''),
  );
}
