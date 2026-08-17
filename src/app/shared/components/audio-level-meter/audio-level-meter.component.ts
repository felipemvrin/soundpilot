import { Component, input } from '@angular/core';

@Component({
  selector: 'app-audio-level-meter',
  template: '<div class="meter"><span [style.width.%]="level() * 100"></span></div>',
  styles: [
    ':host{display:block}.meter{background:#202938;border-radius:2px;height:.7rem;overflow:hidden;width:100%}.meter span{background:#e9bd4d;display:block;height:100%;transition:width .1s}',
  ],
})
export class AudioLevelMeterComponent {
  readonly level = input(0);
}
