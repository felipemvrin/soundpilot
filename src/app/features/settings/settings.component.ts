import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';

import { MicrophoneService } from '../../core/audio/microphone.service';
import { SpeechRecognitionService } from '../../core/speech/speech-recognition.service';
import { LiveSessionService } from '../../core/services/live-session.service';
import { SettingsService } from '../../core/services/settings.service';
import { AudioLevelMeterComponent } from '../../shared/components/audio-level-meter/audio-level-meter.component';
import { AudioDevicesSectionComponent } from './audio-devices/audio-devices.component';
import { AudioConfigSectionComponent } from './audio-config/audio-config.component';
import { TriggerBehaviorSectionComponent } from './trigger-behavior/trigger-behavior.component';
import { PlaybackConfigSectionComponent } from './playback-config/playback-config.component';
import { SystemStatusSectionComponent } from './system-status/system-status.component';
import { PermissionsSectionComponent } from './permissions/permissions.component';
import { SafeActionsSectionComponent } from './safe-actions/safe-actions.component';

const LANGUAGES = [
  { value: 'es-ES', label: 'Español (España)' },
  { value: 'es-419', label: 'Español (Latinoamérica)' },
  { value: 'es-AR', label: 'Español (Argentina)' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'pt-BR', label: 'Português (Brasil)' },
];

/**
 * Main Settings component.
 * Orchestrates all configuration sections: audio devices, audio config, triggers,
 * playback, system status, permissions, and safe actions.
 */
@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    AudioLevelMeterComponent,
    AudioDevicesSectionComponent,
    AudioConfigSectionComponent,
    TriggerBehaviorSectionComponent,
    PlaybackConfigSectionComponent,
    SystemStatusSectionComponent,
    PermissionsSectionComponent,
    SafeActionsSectionComponent,
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  readonly session = inject(LiveSessionService);
  readonly microphone = inject(MicrophoneService);
  readonly speech = inject(SpeechRecognitionService);
  readonly settings$ = inject(SettingsService);

  readonly languages = LANGUAGES;
}
