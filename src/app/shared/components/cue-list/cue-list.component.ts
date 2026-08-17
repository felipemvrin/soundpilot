import { Component, input, output } from '@angular/core';

import { Cue } from '../../../core/models/cue.model';
import { CueCardComponent } from '../cue-card/cue-card.component';

@Component({
  selector: 'app-cue-list',
  imports: [CueCardComponent],
  template:
    '@for (cue of cues(); track cue.id) { <app-cue-card [cue]="cue" (play)="play.emit($event)" /> }',
  styles: [':host{display:grid;gap:.75rem}'],
})
export class CueListComponent {
  readonly cues = input.required<readonly Cue[]>();
  readonly play = output<Cue>();
}
