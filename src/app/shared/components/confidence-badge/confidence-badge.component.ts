import { Component, computed, input } from '@angular/core';

import { ConfidenceLevel } from '../../../core/models/cue.model';

const LEVEL_LABEL: Record<ConfidenceLevel, string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
  unknown: 'Confidence not reported',
};

@Component({
  selector: 'app-confidence-badge',
  template: `
    <span class="value">{{ percent() }}</span>
    <span class="label">{{ label() }}</span>
    <span class="bar" aria-hidden="true"><i [style.width.%]="fill()" [class]="level()"></i></span>
  `,
  styles: [
    `
      :host {
        align-items: center;
        display: inline-grid;
        gap: 0.15rem 0.5rem;
        grid-template-columns: auto 1fr;
      }
      .value {
        font-size: 1.1rem;
        font-weight: 700;
      }
      .label {
        color: var(--muted);
        font-size: 0.72rem;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      .bar {
        background: var(--surface-deep);
        border-radius: 2px;
        grid-column: 1 / -1;
        height: 0.35rem;
        overflow: hidden;
        width: 100%;
      }
      .bar i {
        display: block;
        height: 100%;
        transition: width 0.15s ease;
      }
      .bar i.high {
        background: var(--ok);
      }
      .bar i.medium {
        background: var(--warn);
      }
      .bar i.low,
      .bar i.unknown {
        background: #6c7a91;
      }
    `,
  ],
})
export class ConfidenceBadgeComponent {
  readonly confidence = input<number | undefined>(undefined);
  readonly level = input<ConfidenceLevel>('unknown');

  readonly percent = computed(() => {
    const value = this.confidence();
    return value === undefined ? 'n/a' : `${Math.round(value * 100)}%`;
  });
  readonly label = computed(() => LEVEL_LABEL[this.level()]);
  readonly fill = computed(() => (this.confidence() ?? 0) * 100);
}
