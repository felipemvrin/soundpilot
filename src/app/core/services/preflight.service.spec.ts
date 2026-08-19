import { createEnvironmentInjector, runInInjectionContext, signal } from '@angular/core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Cue } from '../models/cue.model';
import { SpeechRecognitionService } from '../speech/speech-recognition.service';
import { PreflightService } from './preflight.service';
import { TextNormalizerService } from './text-normalizer.service';

const cue = (overrides: Partial<Cue> = {}): Cue => ({
  id: 'cue-1',
  name: 'INTRO',
  triggers: [{ id: 'intro', value: 'intro' }],
  audioFile: 'data:audio/wav;base64,AA==',
  mode: 'automatic',
  enabled: true,
  cooldownMs: 3000,
  volume: 1,
  priority: 'normal',
  confidenceThreshold: 0.9,
  shortcut: 'F1',
  ...overrides,
});

const devices = (inputs = 1, outputs = 1): MediaDeviceInfo[] =>
  [
    ...Array.from({ length: inputs }, (_, index) => ({
      kind: 'audioinput',
      deviceId: `input-${index}`,
    })),
    ...Array.from({ length: outputs }, (_, index) => ({
      kind: 'audiooutput',
      deviceId: `output-${index}`,
    })),
  ] as MediaDeviceInfo[];

const createService = (speechAvailable = true) => {
  const injector = createEnvironmentInjector([
    {
      provide: SpeechRecognitionService,
      useValue: { available: signal(speechAvailable), language: signal('es-ES') },
    },
    {
      provide: TextNormalizerService,
      useValue: { normalize: (value: string) => value.trim().toLowerCase() },
    },
  ]);
  return {
    injector,
    service: runInInjectionContext(injector, () => new PreflightService()),
  };
};

const setBrowserState = (
  mediaDevices: MediaDeviceInfo[] | undefined,
  permission: PermissionState = 'granted',
) => {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value:
      mediaDevices === undefined
        ? undefined
        : { enumerateDevices: vi.fn().mockResolvedValue(mediaDevices), getUserMedia: vi.fn() },
  });
  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    value: { query: vi.fn().mockResolvedValue({ state: permission }) },
  });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
};

describe('PreflightService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reports READY FOR LIVE when every required capability is available', async () => {
    setBrowserState(devices());
    const { service, injector } = createService();
    const report = await service.run([cue()]);

    expect(report.status).toBe('ready');
    expect(report.checks.every((check) => check.status === 'pass')).toBe(true);
    injector.destroy();
  });

  it('separates a denied microphone permission from no input device', async () => {
    setBrowserState(devices(), 'denied');
    const { service, injector } = createService();
    const report = await service.run([cue()]);

    expect(report.checks.find((check) => check.id === 'microphone')?.message).toBe(
      'Microphone permission denied.',
    );
    expect(report.status).toBe('attention-required');
    injector.destroy();
  });

  it('reports a missing microphone device separately from a permission error', async () => {
    setBrowserState(devices(0));
    const { service, injector } = createService();
    const report = await service.run([cue()]);

    expect(report.checks.find((check) => check.id === 'microphone')?.message).toBe(
      'No microphone device detected.',
    );
    injector.destroy();
  });

  it('warns when microphone devices cannot be enumerated', async () => {
    setBrowserState(devices());
    navigator.mediaDevices.enumerateDevices = vi.fn().mockRejectedValue(new Error('blocked'));
    const { service, injector } = createService();
    const report = await service.run([cue()]);

    const microphone = report.checks.find((check) => check.id === 'microphone');
    expect(microphone?.status).toBe('warning');
    expect(microphone?.label).toBe('Microphone permission required');
    expect(report.status).toBe('ready-with-warnings');
    injector.destroy();
  });

  it('reports missing audio, unavailable speech and disabled cues as actionable statuses', async () => {
    setBrowserState(devices());
    const { service, injector } = createService(false);
    const report = await service.run([
      cue({ audioFile: '', enabled: true }),
      cue({ id: 'disabled', name: 'BED', enabled: false }),
    ]);

    expect(report.checks.find((check) => check.id === 'speech')?.status).toBe('fail');
    expect(report.checks.find((check) => check.id === 'audio-files')?.details).toContain(
      'INTRO: no audio file configured.',
    );
    expect(report.checks.find((check) => check.id === 'disabled')?.status).toBe('warning');
    expect(report.status).toBe('attention-required');
    injector.destroy();
  });

  it('detects duplicate names, triggers, shortcuts and invalid cue configuration', async () => {
    setBrowserState(devices());
    const { service, injector } = createService();
    const report = await service.run([
      cue(),
      cue({
        id: 'cue-2',
        name: 'intro',
        triggers: [{ id: 'again', value: 'INTRO' }],
        shortcut: 'F1',
        mode: 'invalid' as Cue['mode'],
        confidenceThreshold: 1.1,
        cooldownMs: -1,
      }),
    ]);

    expect(report.checks.find((check) => check.id === 'cue-names')?.status).toBe('fail');
    expect(report.checks.find((check) => check.id === 'trigger-conflicts')?.status).toBe('fail');
    expect(report.checks.find((check) => check.id === 'shortcuts')?.status).toBe('fail');
    expect(report.checks.find((check) => check.id === 'modes')?.status).toBe('fail');
    expect(report.checks.find((check) => check.id === 'confidence')?.status).toBe('fail');
    expect(report.checks.find((check) => check.id === 'cooldown')?.status).toBe('fail');
    injector.destroy();
  });

  it('reports repeated triggers within one cue and missing shortcuts without blocking air mode', async () => {
    setBrowserState(devices());
    const { service, injector } = createService();
    const report = await service.run([
      cue({
        triggers: [
          { id: 'one', value: 'intro' },
          { id: 'two', value: 'INTRO' },
        ],
      }),
      cue({
        id: 'cue-2',
        name: 'BED',
        triggers: [{ id: 'bed', value: 'bed' }],
        shortcut: undefined,
      }),
    ]);

    expect(report.checks.find((check) => check.id === 'trigger-conflicts')?.status).toBe('fail');
    expect(report.checks.find((check) => check.id === 'shortcuts')?.status).toBe('warning');
    injector.destroy();
  });

  it('reports READY WITH WARNINGS when output cannot be verified automatically', async () => {
    setBrowserState(devices(1, 0));
    const { service, injector } = createService();
    const report = await service.run([cue()]);

    expect(report.checks.find((check) => check.id === 'output')?.status).toBe('warning');
    expect(report.status).toBe('ready-with-warnings');
    injector.destroy();
  });
});
