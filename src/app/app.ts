import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { LiveSessionService } from './core/services/live-session.service';
import { AppHeaderComponent } from './shared/components/app-header/app-header.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AppHeaderComponent],
  template: `
    <app-header
      [status]="session.systemStatus()"
      [micActive]="session.isListening()"
      [level]="session.audioLevel()"
      [airMode]="session.airMode()"
    />
    <router-outlet />
  `,
  styles: [':host{display:block;min-height:100vh}'],
})
export class AppComponent {
  readonly session = inject(LiveSessionService);
}
