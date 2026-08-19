import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
  });

  it('loads permission state during initialization', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        enumerateDevices: vi.fn().mockResolvedValue([]),
        getUserMedia: vi.fn(),
      },
    });
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: {
        query: vi.fn().mockImplementation(({ name }: { name: PermissionName }) =>
          Promise.resolve({
            state: name === 'notifications' ? 'denied' : 'prompt',
          }),
        ),
      },
    });

    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), SettingsService],
    });
    const service = TestBed.inject(SettingsService);

    await vi.waitFor(() => {
      expect(service.settings().permissions).toEqual({
        microphone: 'prompt',
        audioInput: 'prompt',
        notifications: 'denied',
      });
    });
  });
});
