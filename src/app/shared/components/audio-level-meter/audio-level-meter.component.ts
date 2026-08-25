import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-audio-level-meter',
  template: `<div
    class="meter"
    role="meter"
    aria-valuemin="0"
    aria-valuemax="100"
    [attr.aria-valuenow]="percent()"
    [attr.aria-label]="label()"
  >
    <span [style.width.%]="percent()"></span>
  </div>`,
  styles: [
    ':host{display:block}.meter{background:var(--surface-deep);border:1px solid var(--line);border-radius:2px;box-shadow:0 1px 2px rgb(0 0 0 / 55%) inset;height:.7rem;overflow:hidden;width:100%}.meter span{background:linear-gradient(90deg,var(--ok),var(--warn) 78%,var(--danger));display:block;height:100%;transition:width .1s}',
  ],
})
export class AudioLevelMeterComponent {
  readonly level = input(0);
  readonly label = input('Input level');
  readonly percent = computed(() => Math.round(Math.min(1, Math.max(0, this.level())) * 100));
}
