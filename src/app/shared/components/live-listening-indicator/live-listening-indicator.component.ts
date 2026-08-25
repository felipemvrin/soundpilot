import { Component, computed, input } from '@angular/core';

/**
 * LIVE LISTENING indicator: a breathing dot + minimal bar waveform driven by the microphone
 * level, so an operator can tell "SoundPilot is receiving audio" at a glance. Pure presentational,
 * CSS-only animation (no rAF/timers) to keep it cheap to render continuously during a broadcast.
 */
@Component({
  selector: 'app-live-listening-indicator',
  template: `
    <div class="row">
      <span class="dot" [class.active]="active()" aria-hidden="true"></span>
      <span class="label">{{ label() }}</span>
    </div>
    <div class="scale" aria-hidden="true">
      <span>-60</span><span>-48</span><span>-36</span><span>-24</span><span>-18</span
      ><span>-12</span><span>-6</span><span>0</span>
    </div>
    <div class="bars" role="img" [attr.aria-label]="label() + ', input level ' + percent() + '%'">
      @for (bar of bars; track bar) {
        <span [style.height.%]="barHeight(bar)" [class.active]="active()"></span>
      }
    </div>
    <span class="hint">Microphone / audio input</span>
  `,
  styles: [
    `
      :host {
        display: grid;
        gap: 0.5rem;
      }
      .row {
        align-items: center;
        display: flex;
        gap: 0.5rem;
      }
      .dot {
        background: #6c7a91;
        border-radius: 50%;
        height: 0.6rem;
        width: 0.6rem;
      }
      .dot.active {
        animation: breathe 2.2s ease-in-out infinite;
        background: var(--ok-soft);
      }
      .label {
        color: var(--muted);
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }
      .bars {
        background: var(--surface-deep);
        border: 1px solid var(--line);
        border-radius: 3px;
        align-items: flex-end;
        display: flex;
        gap: 0.2rem;
        height: 2.6rem;
        padding: 0.35rem;
        box-shadow: 0 1px 2px rgb(0 0 0 / 50%) inset;
      }
      .scale {
        color: var(--muted);
        display: flex;
        font: 0.55rem/1 var(--mono);
        justify-content: space-between;
        padding: 0 0.35rem;
      }
      .bars span {
        background: #263447;
        border-radius: 2px;
        flex: 1;
        min-height: 8%;
        transition: height 0.12s ease;
      }
      .bars span.active {
        background: var(--ok);
        box-shadow: 0 0 5px rgb(105 213 198 / 22%);
      }
      .bars span:nth-last-child(-n + 4).active {
        background: var(--warn);
      }
      .bars span:nth-last-child(-n + 2).active {
        background: var(--danger);
      }
      .hint {
        color: var(--muted);
        font-size: 0.7rem;
      }
      @keyframes breathe {
        0%,
        100% {
          opacity: 1;
          transform: scale(1);
        }
        50% {
          opacity: 0.45;
          transform: scale(1.35);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .dot.active {
          animation: none;
        }
      }
    `,
  ],
})
export class LiveListeningIndicatorComponent {
  readonly active = input(false);
  readonly level = input(0);
  /** Real per-band frequency levels (0-1) from the microphone analyser; falls back to a synthetic wave when empty. */
  readonly bands = input<readonly number[]>([]);
  readonly label = input('LIVE LISTENING');

  protected readonly bars = Array.from({ length: 14 }, (_, index) => index);

  readonly percent = computed(() => Math.round(Math.min(1, Math.max(0, this.level())) * 100));

  barHeight(bar: number): number {
    if (!this.active()) return 8;
    const bands = this.bands();
    if (bands.length > bar) {
      return Math.min(100, Math.max(8, bands[bar] * 100));
    }
    const base = this.percent();
    // No band data yet (first frame): deterministic per-bar variation so the waveform reads as organic.
    const wave = Math.abs(Math.sin(bar * 1.7)) * 45;
    return Math.min(100, Math.max(8, base * 0.6 + wave));
  }
}
