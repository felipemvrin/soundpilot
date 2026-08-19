import { Injectable, inject } from '@angular/core';

import { Cue } from '../models/cue.model';
import { PreflightCheck, PreflightReport, PreflightStatus } from '../models/session.model';
import { SpeechRecognitionService } from '../speech/speech-recognition.service';
import { TextNormalizerService } from './text-normalizer.service';

export type PreflightProgressHandler = (message: string) => void;

@Injectable({ providedIn: 'root' })
export class PreflightService {
  private readonly speech = inject(SpeechRecognitionService);
  private readonly normalizer = inject(TextNormalizerService);

  async run(cues: readonly Cue[], onProgress?: PreflightProgressHandler): Promise<PreflightReport> {
    onProgress?.('Collecting system state...');
    const [devices, microphonePermission] = await Promise.all([
      this.enumerateDevices(),
      this.microphonePermission(),
    ]);
    const checks: PreflightCheck[] = [];
    const addCheck = (message: string, check: PreflightCheck): void => {
      onProgress?.(message);
      checks.push(check);
    };
    addCheck('Checking microphone...', this.microphoneCheck(devices, microphonePermission));
    addCheck('Checking speech recognition...', this.speechCheck());
    addCheck('Checking audio output...', this.outputCheck(devices));
    addCheck('Checking cues...', this.cuesLoadedCheck(cues));
    onProgress?.('Checking audio files...');
    checks.push(await this.audioFilesCheck(cues));
    addCheck('Checking triggers...', this.triggerConfigCheck(cues));
    addCheck('Checking trigger conflicts...', this.duplicateTriggersCheck(cues));
    addCheck('Checking cue names...', this.duplicateNamesCheck(cues));
    addCheck('Checking keyboard shortcuts...', this.shortcutsCheck(cues));
    addCheck('Checking cue modes...', this.modeCheck(cues));
    addCheck('Checking confidence thresholds...', this.confidenceCheck(cues));
    addCheck('Checking cooldowns...', this.cooldownCheck(cues));
    addCheck('Checking disabled cues...', this.disabledCuesCheck(cues));
    return { checks, status: this.statusFor(checks), timestamp: Date.now() };
  }

  private async enumerateDevices(): Promise<MediaDeviceInfo[] | undefined> {
    if (!navigator.mediaDevices?.enumerateDevices) return undefined;
    try {
      return await navigator.mediaDevices.enumerateDevices();
    } catch {
      return undefined;
    }
  }

  private async microphonePermission(): Promise<PermissionState | undefined> {
    if (!navigator.permissions?.query) return undefined;
    try {
      return (await navigator.permissions.query({ name: 'microphone' as PermissionName })).state;
    } catch {
      return undefined;
    }
  }

  private microphoneCheck(
    devices: MediaDeviceInfo[] | undefined,
    microphonePermission: PermissionState | undefined,
  ): PreflightCheck {
    if (!navigator.mediaDevices?.getUserMedia) {
      return {
        id: 'microphone',
        label: 'Microphone',
        status: 'fail',
        severity: 'error',
        message: 'Microphone unavailable in this browser/environment.',
        details: ['Use a browser that exposes audio capture over HTTPS.'],
        actionLabel: 'Open settings',
        actionRoute: '/settings',
      };
    }
    if (microphonePermission === 'denied') {
      return {
        id: 'microphone',
        label: 'Microphone permission denied',
        status: 'fail',
        severity: 'error',
        message: 'Microphone permission denied.',
        details: ['Allow microphone access in the browser settings.'],
        actionLabel: 'Open settings',
        actionRoute: '/settings',
      };
    }
    if (devices === undefined) {
      return {
        id: 'microphone',
        label: 'Microphone permission required',
        status: 'warning',
        severity: 'warning',
        message: 'SoundPilot could not inspect microphone devices.',
        details: ['Allow microphone access in the browser settings, then run preflight again.'],
        actionLabel: 'Open settings',
        actionRoute: '/settings',
      };
    }
    const inputs = devices.filter((device) => device.kind === 'audioinput');
    return {
      id: 'microphone',
      label: 'Microphone',
      status: inputs.length ? 'pass' : 'fail',
      severity: inputs.length ? 'info' : 'error',
      message: inputs.length
        ? 'Microphone ready. Input device detected.'
        : 'No microphone device detected.',
      details: inputs.length ? undefined : ['Connect or enable a microphone.'],
      actionLabel: inputs.length ? undefined : 'Open settings',
      actionRoute: inputs.length ? undefined : '/settings',
    };
  }

  private speechCheck(): PreflightCheck {
    const available = this.speech.available();
    return {
      id: 'speech',
      label: 'Speech recognition',
      status: available ? 'pass' : 'fail',
      severity: available ? 'info' : 'error',
      message: available
        ? `Recognition service available (${this.speech.language()}).`
        : 'Speech recognition is unavailable in this browser/environment.',
      details: available ? undefined : ['Cues can only be fired manually.'],
      actionLabel: available ? undefined : 'Open settings',
      actionRoute: available ? undefined : '/settings',
    };
  }

  private outputCheck(devices: MediaDeviceInfo[] | undefined): PreflightCheck {
    const outputs = devices?.filter((device) => device.kind === 'audiooutput') ?? [];
    if (outputs.length) {
      return {
        id: 'output',
        label: 'Audio output',
        status: 'pass',
        severity: 'info',
        message: 'Output available.',
        details: [`${outputs.length} output device(s) detected.`],
      };
    }
    const canPlay = typeof Audio !== 'undefined';
    return {
      id: 'output',
      label: 'Audio output',
      status: canPlay ? 'warning' : 'fail',
      severity: canPlay ? 'warning' : 'error',
      message: canPlay
        ? 'Output device cannot be verified automatically.'
        : 'No audio output is available.',
      details: [canPlay ? 'Run a test cue to verify playback.' : 'Check the system audio device.'],
      actionLabel: canPlay ? 'Play test cue' : 'Open cues',
      actionRoute: canPlay ? undefined : '/cues',
      actionId: canPlay ? 'test-output' : undefined,
    };
  }

  private cuesLoadedCheck(cues: readonly Cue[]): PreflightCheck {
    const enabled = cues.filter((cue) => cue.enabled);
    return {
      id: 'cues',
      label: 'Cues',
      status: enabled.length ? 'pass' : 'fail',
      severity: enabled.length ? 'info' : 'error',
      message: enabled.length ? `${cues.length} cue(s) configured.` : 'No cues configured.',
      details: enabled.length
        ? undefined
        : ['Create and enable at least one cue before going live.'],
      actionLabel: enabled.length ? undefined : 'Create cue',
      actionRoute: enabled.length ? undefined : '/cues',
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
      label: 'Audio files',
      status: passed ? 'pass' : 'fail',
      severity: passed ? 'info' : 'error',
      message: `${active.length - missing.length - unreachable.length} / ${active.length} active cues have valid audio.`,
      details: [
        ...missing.map((cue) => `${cue.name}: no audio file configured.`),
        ...unreachable.map((name) => `${name}: audio file is unavailable.`),
      ],
      actionLabel: passed ? undefined : 'Fix cues',
      actionRoute: passed ? undefined : '/cues',
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
    const invalid = cues
      .filter(
        (cue) =>
          cue.enabled &&
          (!cue.triggers.length || cue.triggers.some((trigger) => !trigger.value.trim())),
      )
      .map((cue) =>
        cue.triggers.some((trigger) => !trigger.value.trim())
          ? `${cue.name}: empty trigger.`
          : `${cue.name}: trigger is required.`,
      );
    return {
      id: 'triggers',
      label: 'Triggers',
      status: invalid.length ? 'fail' : 'pass',
      severity: invalid.length ? 'error' : 'info',
      message: invalid.length
        ? 'Some active cues have no valid trigger.'
        : 'All active cues have at least one trigger.',
      details: invalid,
      actionLabel: invalid.length ? 'Fix cues' : undefined,
      actionRoute: invalid.length ? '/cues' : undefined,
    };
  }

  private duplicateTriggersCheck(cues: readonly Cue[]): PreflightCheck {
    const seen = new Map<string, string>();
    const conflicts: string[] = [];
    for (const cue of cues.filter((item) => item.enabled)) {
      const cueTriggers = new Set<string>();
      for (const trigger of cue.triggers) {
        const normalized = this.normalizer.normalize(trigger.value);
        if (!normalized) continue;
        if (cueTriggers.has(normalized)) {
          conflicts.push(`"${trigger.value}" (repeated in ${cue.name})`);
          continue;
        }
        cueTriggers.add(normalized);
        const owner = seen.get(normalized);
        if (owner && owner !== cue.name) {
          conflicts.push(`"${trigger.value}" (${owner} / ${cue.name})`);
        } else {
          seen.set(normalized, cue.name);
        }
      }
    }
    return {
      id: 'trigger-conflicts',
      label: 'Trigger conflicts',
      status: conflicts.length ? 'fail' : 'pass',
      severity: conflicts.length ? 'error' : 'info',
      message: conflicts.length
        ? `${conflicts.length} conflict(s) detected.`
        : `${[...seen.keys()].length} triggers / 0 conflicts.`,
      details: conflicts,
      actionLabel: conflicts.length ? 'Review cues' : undefined,
      actionRoute: conflicts.length ? '/cues' : undefined,
    };
  }

  private shortcutsCheck(cues: readonly Cue[]): PreflightCheck {
    const enabled = cues.filter((cue) => cue.enabled);
    const shortcuts = enabled.map((cue) => cue.shortcut).filter(Boolean) as string[];
    const duplicated = shortcuts.filter((value, index) => shortcuts.indexOf(value) !== index);
    const missing = enabled.filter((cue) => !cue.shortcut);
    const invalid = shortcuts.filter((shortcut) => !/^F[1-9]$/.test(shortcut));
    const hasConflicts = duplicated.length > 0 || invalid.length > 0;
    const status = hasConflicts ? 'fail' : missing.length ? 'warning' : 'pass';
    return {
      id: 'shortcuts',
      label: 'Keyboard shortcuts',
      status,
      severity: hasConflicts ? 'error' : missing.length ? 'warning' : 'info',
      message: hasConflicts
        ? 'Shortcut conflicts detected.'
        : missing.length
          ? 'Some active cues have no shortcut.'
          : `${shortcuts.length} cue shortcut(s) configured / 0 conflicts.`,
      details: [
        ...[...new Set(duplicated)].map(
          (shortcut) =>
            `${shortcut} is assigned to ${enabled
              .filter((cue) => cue.shortcut === shortcut)
              .map((cue) => cue.name)
              .join(' / ')}.`,
        ),
        ...invalid.map((shortcut) => `${shortcut}: shortcut must be F1-F9.`),
        ...missing.map((cue) => `${cue.name}: no shortcut configured.`),
      ],
      actionLabel: status === 'pass' ? undefined : 'Review cues',
      actionRoute: status === 'pass' ? undefined : '/cues',
    };
  }

  private duplicateNamesCheck(cues: readonly Cue[]): PreflightCheck {
    const names = new Map<string, string[]>();
    for (const cue of cues) {
      const key = this.normalizer.normalize(cue.name);
      if (key) names.set(key, [...(names.get(key) ?? []), cue.name]);
    }
    const duplicates = [...names.values()].filter((items) => items.length > 1).flat();
    return {
      id: 'cue-names',
      label: 'Cue names',
      status: duplicates.length ? 'fail' : 'pass',
      severity: duplicates.length ? 'error' : 'info',
      message: duplicates.length ? 'Duplicate cue names detected.' : 'Cue names are unique.',
      details: duplicates,
      actionLabel: duplicates.length ? 'Review cues' : undefined,
      actionRoute: duplicates.length ? '/cues' : undefined,
    };
  }

  private modeCheck(cues: readonly Cue[]): PreflightCheck {
    const invalid = cues
      .filter((cue) => !['automatic', 'confirm', 'manual'].includes(cue.mode))
      .map((cue) => `${cue.name}: invalid execution mode.`);
    return {
      id: 'modes',
      label: 'Cue configuration',
      status: invalid.length ? 'fail' : 'pass',
      severity: invalid.length ? 'error' : 'info',
      message: invalid.length
        ? 'Invalid cue execution mode.'
        : 'All cue execution modes are valid.',
      details: invalid,
      actionLabel: invalid.length ? 'Fix cues' : undefined,
      actionRoute: invalid.length ? '/cues' : undefined,
    };
  }

  private confidenceCheck(cues: readonly Cue[]): PreflightCheck {
    const invalid = cues
      .filter(
        (cue) =>
          cue.mode !== 'manual' &&
          (!Number.isFinite(cue.confidenceThreshold) ||
            (cue.confidenceThreshold ?? -1) < 0 ||
            (cue.confidenceThreshold ?? 2) > 1),
      )
      .map((cue) => `${cue.name}: invalid confidence threshold.`);
    return {
      id: 'confidence',
      label: 'Confidence configuration',
      status: invalid.length ? 'fail' : 'pass',
      severity: invalid.length ? 'error' : 'info',
      message: invalid.length
        ? 'Some cues have invalid thresholds.'
        : `${cues.length} cue(s) configured correctly.`,
      details: invalid,
      actionLabel: invalid.length ? 'Fix cues' : undefined,
      actionRoute: invalid.length ? '/cues' : undefined,
    };
  }

  private cooldownCheck(cues: readonly Cue[]): PreflightCheck {
    const invalid = cues
      .filter((cue) => !Number.isFinite(cue.cooldownMs) || cue.cooldownMs < 0)
      .map((cue) => `${cue.name}: invalid cooldown value.`);
    return {
      id: 'cooldown',
      label: 'Cooldown configuration',
      status: invalid.length ? 'fail' : 'pass',
      severity: invalid.length ? 'error' : 'info',
      message: invalid.length
        ? 'Some cues have invalid cooldown values.'
        : 'All cues have valid cooldown values.',
      details: invalid,
      actionLabel: invalid.length ? 'Fix cues' : undefined,
      actionRoute: invalid.length ? '/cues' : undefined,
    };
  }

  private disabledCuesCheck(cues: readonly Cue[]): PreflightCheck {
    const disabled = cues.filter((cue) => !cue.enabled).map((cue) => cue.name);
    return {
      id: 'disabled',
      label: 'Disabled cues',
      status: disabled.length ? 'warning' : 'pass',
      severity: disabled.length ? 'warning' : 'info',
      message: disabled.length
        ? `${disabled.length} cue(s) are currently disabled.`
        : 'No cues are disabled.',
      details: disabled.length ? [...disabled, 'They will not trigger automatically.'] : undefined,
      actionLabel: disabled.length ? 'Review cues' : undefined,
      actionRoute: disabled.length ? '/cues' : undefined,
    };
  }

  statusFor(checks: readonly PreflightCheck[]): PreflightStatus {
    if (checks.some((check) => check.status === 'fail')) return 'attention-required';
    return checks.some((check) => check.status === 'warning') ? 'ready-with-warnings' : 'ready';
  }
}
