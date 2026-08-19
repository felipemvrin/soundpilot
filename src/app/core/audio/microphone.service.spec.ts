import { signal } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_SETTINGS } from '../models/settings.model';
import { SettingsService } from '../services/settings.service';
import { MicrophoneService } from './microphone.service';

const stream = () =>
  ({
    getTracks: () => [{ stop: vi.fn() }],
  }) as unknown as MediaStream;

describe('MicrophoneService', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', vi.fn().mockReturnValue(1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal(
      'AudioContext',
      class {
        createAnalyser() {
          return {
            fftSize: 256,
            frequencyBinCount: 128,
            getByteTimeDomainData: (data: Uint8Array) => data.fill(128),
            getByteFrequencyData: (data: Uint8Array) => data.fill(0),
          };
        }

        createMediaStreamSource() {
          return { connect: vi.fn() };
        }

        resume = vi.fn().mockResolvedValue(undefined);
        close = vi.fn().mockResolvedValue(undefined);
      },
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it('requests the selected input device when one is configured', async () => {
    const getUserMedia = vi.fn().mockResolvedValue(stream());
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });

    const service = new MicrophoneService({
      settings: signal({
        ...DEFAULT_SETTINGS,
        audio: {
          ...DEFAULT_SETTINGS.audio,
          inputDevice: { id: 'mic-1', label: 'Studio Mic' },
        },
      }),
    } as SettingsService);

    await service.start();
    service.stop();

    expect(getUserMedia).toHaveBeenCalledWith({
      audio: { deviceId: { exact: 'mic-1' } },
    });
  });

  it('falls back to the default microphone when the selected device cannot be opened', async () => {
    const getUserMedia = vi
      .fn()
      .mockRejectedValueOnce(new Error('device missing'))
      .mockResolvedValueOnce(stream());
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });

    const service = new MicrophoneService({
      settings: signal({
        ...DEFAULT_SETTINGS,
        audio: {
          ...DEFAULT_SETTINGS.audio,
          inputDevice: { id: 'missing-mic', label: 'Missing Mic' },
        },
      }),
    } as SettingsService);

    await service.start();
    service.stop();

    expect(getUserMedia).toHaveBeenNthCalledWith(1, {
      audio: { deviceId: { exact: 'missing-mic' } },
    });
    expect(getUserMedia).toHaveBeenNthCalledWith(2, { audio: true });
  });
});
