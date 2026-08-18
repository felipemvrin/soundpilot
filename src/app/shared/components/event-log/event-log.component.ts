import { DatePipe } from '@angular/common';
import { Component, input } from '@angular/core';

import { SessionEvent, SessionOutcome } from '../../../core/models/session.model';

const OUTCOME_LABEL: Record<SessionOutcome, string> = {
  detected: 'Detected',
  pending: 'Awaiting',
  played: 'Played',
  ignored: 'Ignored',
  stopped: 'Stopped',
  expired: 'Expired',
  error: 'Error',
};

const OUTCOME_GLYPH: Record<SessionOutcome, string> = {
  detected: '·',
  pending: '?',
  played: '✓',
  ignored: '○',
  stopped: '■',
  expired: '×',
  error: '⚠',
};

@Component({
  selector: 'app-event-log',
  imports: [DatePipe],
  template: `
    <ul>
      @for (item of events(); track item.id) {
        <li [class]="'outcome-' + item.outcome">
          <time>{{ item.timestamp | date: 'HH:mm:ss' }}</time>
          <span class="cue"
            ><span aria-hidden="true">{{ glyph(item.outcome) }}</span> {{ item.cueName }}</span
          >
          <span class="phrase">{{ item.phrase ?? item.detail ?? '—' }}</span>
          <span class="confidence">{{
            item.confidence === undefined ? '—' : (item.confidence * 100).toFixed(0) + '%'
          }}</span>
          <span class="result">{{ label(item.outcome) }}</span>
        </li>
      } @empty {
        <li class="empty">No events yet. Events appear here as cues are detected and fired.</li>
      }
    </ul>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 0;
        overflow: auto;
      }
      ul {
        display: grid;
        list-style: none;
        margin: 0;
        padding: 0;
      }
      li {
        align-items: baseline;
        border-top: 1px solid var(--line);
        display: grid;
        font-size: 0.78rem;
        gap: 0.75rem;
        grid-template-columns: 4.5rem 9rem 1fr 3rem 4.5rem;
        padding: 0.42rem 0;
      }
      li:first-child {
        border-top: 0;
      }
      li.empty {
        color: var(--muted);
        display: block;
        padding: 0.6rem 0;
      }
      time,
      .confidence {
        color: var(--muted);
      }
      .cue {
        font-weight: 700;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .phrase {
        color: var(--muted);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .result {
        font-weight: 700;
        text-align: right;
      }
      .outcome-played .result,
      .outcome-played .cue {
        color: var(--ok-soft);
      }
      .outcome-error .result,
      .outcome-error .cue {
        color: var(--danger);
      }
      .outcome-ignored .result,
      .outcome-expired .result {
        color: var(--muted);
      }
      .outcome-pending .result {
        color: var(--warn);
      }
      @media (max-width: 1100px) {
        li {
          grid-template-columns: 4.5rem 8rem 1fr 4rem;
        }
        .confidence {
          display: none;
        }
      }
    `,
  ],
})
export class EventLogComponent {
  readonly events = input.required<readonly SessionEvent[]>();

  label(outcome: SessionOutcome): string {
    return OUTCOME_LABEL[outcome];
  }

  glyph(outcome: SessionOutcome): string {
    return OUTCOME_GLYPH[outcome];
  }
}
