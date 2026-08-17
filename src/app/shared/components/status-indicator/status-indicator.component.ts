import { Component, input } from '@angular/core';

@Component({
  selector: 'app-status-indicator',
  template: '<span class="indicator" [class.active]="active()"><i></i>{{ label() }}</span>',
  styles: [
    ':host{display:inline-block}.indicator{color:#9eacc0;font:700 .75rem ui-monospace,monospace}.indicator i{background:#7d8798;border-radius:50%;display:inline-block;height:.55rem;margin-right:.4rem;width:.55rem}.indicator.active{color:#a4f7bc}.indicator.active i{background:#42d878}',
  ],
})
export class StatusIndicatorComponent {
  readonly active = input(false);
  readonly label = input('READY');
}
