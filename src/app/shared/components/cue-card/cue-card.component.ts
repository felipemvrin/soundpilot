import { Component, input, output } from '@angular/core';

import { Cue } from '../../../core/models/cue.model';

@Component({
  selector: 'app-cue-card',
  template:
    '<article [class.disabled]="!cue().enabled"><div><strong>{{ cue().name }}</strong><p>{{ triggerLabel() }}</p></div><button type="button" (click)="play.emit(cue())">Play</button></article>',
  styles: [
    'article{align-items:center;background:#1b2738;border-left:3px solid #75d3c6;border-radius:4px;color:#eff5ff;display:flex;font-family:ui-monospace,monospace;justify-content:space-between;padding:.85rem}article.disabled{opacity:.55}p{color:#9eacc0;font-size:.8rem;margin:.35rem 0 0}button{background:#75d3c6;border:0;border-radius:4px;color:#122033;font:inherit;font-weight:700;padding:.5rem .75rem}',
  ],
})
export class CueCardComponent {
  readonly cue = input.required<Cue>();
  readonly play = output<Cue>();

  triggerLabel(): string {
    return this.cue()
      .triggers.map((trigger) => trigger.value)
      .join(' · ');
  }
}
