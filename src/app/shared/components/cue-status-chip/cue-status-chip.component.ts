import { Component, computed, input, output } from '@angular/core';

import { Cue, CueRuntimeStatus } from '../../../core/models/cue.model';

const STATUS_LABEL: Record<CueRuntimeStatus, string> = {
  ready: 'READY',
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
  template: `
    <button
      type="button"
      class="chip"
      [class]="'chip status-' + status()"
      [disabled]="status() === 'disabled'"
      [attr.aria-label]="ariaLabel()"
      (click)="fire.emit(cue())"
    >
      <span class="name">{{ cue().name }}</span>
      <span class="status"
        ><span aria-hidden="true">{{ glyph() }}</span> {{ label() }}</span
      >
      <span class="kbd">{{ cue().shortcut ?? '—' }}</span>
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
  readonly fire = output<Cue>();

  readonly label = computed(() => STATUS_LABEL[this.status()]);
  readonly glyph = computed(() => STATUS_GLYPH[this.status()]);
  readonly ariaLabel = computed(
    () =>
      `Play cue ${this.cue().name}, status ${STATUS_LABEL[this.status()]}` +
      (this.cue().shortcut ? `, shortcut ${this.cue().shortcut}` : ''),
  );
}
