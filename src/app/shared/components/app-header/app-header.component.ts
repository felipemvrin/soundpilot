import { Component, computed, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { SystemStatus } from '../../../core/models/cue.model';
import { AudioLevelMeterComponent } from '../audio-level-meter/audio-level-meter.component';

const STATUS_LABEL: Record<SystemStatus, string> = {
  ready: 'READY',
  listening: 'LISTENING',
  processing: 'PROCESSING',
  playing: 'PLAYING',
  paused: 'PAUSED',
  error: 'ERROR',
};

const STATUS_ICON: Record<SystemStatus, string> = {
  ready: '○',
  listening: '●',
  processing: '◐',
  playing: '▶',
  paused: '❙❙',
  error: '⚠',
};

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive, AudioLevelMeterComponent],
  templateUrl: './app-header.component.html',
  styleUrl: './app-header.component.scss',
})
export class AppHeaderComponent {
  readonly status = input<SystemStatus>('ready');
  readonly micActive = input(false);
  readonly level = input(0);
  readonly airMode = input(false);

  readonly statusLabel = computed(() => STATUS_LABEL[this.status()]);
  readonly statusIcon = computed(() => STATUS_ICON[this.status()]);
  readonly statusClass = computed(() => `state--${this.status()}`);
}
