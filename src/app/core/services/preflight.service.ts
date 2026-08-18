import { Injectable, inject } from '@angular/core';

import { Cue } from '../models/cue.model';
import { PreflightCheck, PreflightReport } from '../models/session.model';
import { SpeechRecognitionService } from '../speech/speech-recognition.service';
import { TextNormalizerService } from './text-normalizer.service';

@Injectable({ providedIn: 'root' })
export class PreflightService {
  private readonly speech = inject(SpeechRecognitionService);
  private readonly normalizer = inject(TextNormalizerService);

  async run(cues: readonly Cue[]): Promise<PreflightReport> {
    const devices = await this.enumerateDevices();
    const checks: PreflightCheck[] = [
      this.microphoneCheck(devices),
      this.speechCheck(),
      this.outputCheck(devices),
      this.cuesLoadedCheck(cues),
      await this.audioFilesCheck(cues),
      this.triggerConfigCheck(cues),
      this.duplicateTriggersCheck(cues),
      this.shortcutsCheck(cues),
    ];
    return { checks, ready: checks.every((check) => check.passed), timestamp: Date.now() };
  }

  private async enumerateDevices(): Promise<MediaDeviceInfo[] | undefined> {
    if (!navigator.mediaDevices?.enumerateDevices) return undefined;
    try {
      return await navigator.mediaDevices.enumerateDevices();
    } catch {
      return undefined;
    }
  }

  private microphoneCheck(devices: MediaDeviceInfo[] | undefined): PreflightCheck {
    if (!navigator.mediaDevices?.getUserMedia) {
      return {
        id: 'microphone',
        label: 'Microphone detected',
        passed: false,
        detail:
          'This browser does not expose audio capture. Use a Chromium based browser over HTTPS.',
      };
    }
    if (devices === undefined) {
      return {
        id: 'microphone',
        label: 'Microphone detected',
        passed: false,
        detail: 'Device list unavailable. Grant microphone permission and run preflight again.',
      };
    }
    const inputs = devices.filter((device) => device.kind === 'audioinput');
    return {
      id: 'microphone',
      label: 'Microphone detected',
      passed: inputs.length > 0,
      detail: inputs.length
        ? `${inputs.length} input device(s) available.`
        : 'No audio input device found. Connect a microphone and grant permission.',
    };
  }

  private speechCheck(): PreflightCheck {
    const available = this.speech.available();
    return {
      id: 'speech',
      label: 'Speech recognition ready',
      passed: available,
      detail: available
        ? `Recognition engine available (${this.speech.language()}).`
        : 'Web Speech API not available. Cues can only be fired manually.',
    };
  }

  private outputCheck(devices: MediaDeviceInfo[] | undefined): PreflightCheck {
    const outputs = devices?.filter((device) => device.kind === 'audiooutput') ?? [];
    if (outputs.length) {
      return {
        id: 'output',
        label: 'Audio output available',
        passed: true,
        detail: `${outputs.length} output device(s) available.`,
      };
    }
    const canPlay = typeof Audio !== 'undefined';
    return {
      id: 'output',
      label: 'Audio output available',
      passed: canPlay,
      detail: canPlay
        ? 'Output devices are not listed by this browser, but playback is supported.'
        : 'No audio output detected. Check the system audio device.',
    };
  }

  private cuesLoadedCheck(cues: readonly Cue[]): PreflightCheck {
    const enabled = cues.filter((cue) => cue.enabled);
    return {
      id: 'cues',
      label: 'Cues loaded',
      passed: enabled.length > 0,
      detail: enabled.length
        ? `${enabled.length} active cue(s).`
        : 'No active cues. Enable or create at least one cue in CUES.',
    };
  }

  private async audioFilesCheck(cues: readonly Cue[]): Promise<PreflightCheck> {
    const active = cues.filter((cue) => cue.enabled);
    const missing = active.filter((cue) => !cue.audioFile);
    const unreachable: string[] = [];
    for (const cue of active.filter((item) => item.audioFile)) {
      if (!(await this.isReachable(cue.audioFile))) unreachable.push(cue.name);
    }
    const passed = missing.length === 0 && unreachable.length === 0;
    return {
      id: 'audio-files',
      label: 'Audio files available',
      passed,
      detail: missing.length
        ? `Missing audio: ${missing.map((cue) => cue.name).join(', ')}. Assign a file in CUES.`
        : unreachable.length
          ? `Audio no longer available (reassign the file in CUES): ${unreachable.join(', ')}.`
          : 'Every active cue has a reachable audio file.',
    };
  }

  /** Object URLs are dropped when the page reloads, so the file has to be reassigned. */
  private async isReachable(source: string): Promise<boolean> {
    try {
      const response = await fetch(source, { method: 'GET' });
      return response.ok;
    } catch {
      return false;
    }
  }

  private triggerConfigCheck(cues: readonly Cue[]): PreflightCheck {
    const invalid = cues.filter(
      (cue) => cue.enabled && !cue.triggers.some((trigger) => trigger.value.trim()),
    );
    return {
      id: 'triggers',
      label: 'Trigger configuration valid',
      passed: invalid.length === 0,
      detail: invalid.length
        ? `Cues without triggers: ${invalid.map((cue) => cue.name).join(', ')}.`
        : 'All active cues have at least one trigger.',
    };
  }

  private duplicateTriggersCheck(cues: readonly Cue[]): PreflightCheck {
    const seen = new Map<string, string>();
    const conflicts: string[] = [];
    for (const cue of cues.filter((item) => item.enabled)) {
      for (const trigger of cue.triggers) {
        const normalized = this.normalizer.normalize(trigger.value);
        if (!normalized) continue;
        const owner = seen.get(normalized);
        if (owner && owner !== cue.name) {
          conflicts.push(`"${trigger.value}" (${owner} / ${cue.name})`);
        } else {
          seen.set(normalized, cue.name);
        }
      }
    }
    return {
      id: 'duplicates',
      label: 'No conflicting triggers',
      passed: conflicts.length === 0,
      detail: conflicts.length
        ? `Conflicting triggers: ${conflicts.join(', ')}.`
        : 'No duplicate triggers between active cues.',
    };
  }

  private shortcutsCheck(cues: readonly Cue[]): PreflightCheck {
    const enabled = cues.filter((cue) => cue.enabled);
    const shortcuts = enabled.map((cue) => cue.shortcut).filter(Boolean) as string[];
    const duplicated = shortcuts.filter((value, index) => shortcuts.indexOf(value) !== index);
    const missing = enabled.filter((cue) => !cue.shortcut);
    const passed = duplicated.length === 0 && missing.length === 0;
    return {
      id: 'shortcuts',
      label: 'Keyboard shortcuts configured',
      passed,
      detail: passed
        ? `${shortcuts.length} shortcut(s) assigned without conflicts.`
        : duplicated.length
          ? `Duplicated shortcuts: ${[...new Set(duplicated)].join(', ')}.`
          : `Cues without shortcut: ${missing.map((cue) => cue.name).join(', ')}.`,
    };
  }
}
