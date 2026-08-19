import { Component, input } from '@angular/core';

export type SystemStatusItemState = 'ok' | 'warn' | 'error';

export interface SystemStatusItem {
  label: string;
  state: SystemStatusItemState;
  detail: string;
}

/** Compact "is everything working?" checklist, reused by LIVE and PREFLIGHT. */
@Component({
  selector: 'app-system-status-panel',
  template: `
    <ul>
      @for (item of items(); track item.label) {
        <li [class]="'item item--' + item.state">
          <span class="dot" aria-hidden="true"></span>
          <span class="label">{{ item.label }}</span>
          <span class="detail">{{ item.detail }}</span>
        </li>
      }
    </ul>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      ul {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem 1.1rem;
        list-style: none;
        margin: 0;
        padding: 0;
      }
      li {
        align-items: center;
        display: inline-flex;
        font-size: 0.74rem;
        gap: 0.45rem;
      }
      .dot {
        border-radius: 50%;
        flex-shrink: 0;
        height: 0.5rem;
        width: 0.5rem;
      }
      .label {
        color: var(--text);
        font-weight: 700;
        letter-spacing: 0.03em;
      }
      .detail {
        color: var(--muted);
      }
      .item--ok .dot {
        background: var(--ok);
      }
      .item--warn .dot {
        background: var(--warn);
      }
      .item--error .dot {
        background: var(--danger);
      }
    `,
  ],
})
export class SystemStatusPanelComponent {
  readonly items = input.required<readonly SystemStatusItem[]>();
}
