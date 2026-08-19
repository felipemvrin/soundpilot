import { createEnvironmentInjector, runInInjectionContext, signal } from '@angular/core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_SETTINGS } from '../../../core/models/settings.model';
import { SettingsService } from '../../../core/services/settings.service';
import { PermissionsSectionComponent } from './permissions.component';

const createComponent = () => {
  const settings = {
    settings: signal(DEFAULT_SETTINGS),
    checkPermissions: vi.fn().mockResolvedValue(undefined),
  };
  const injector = createEnvironmentInjector([{ provide: SettingsService, useValue: settings }]);
  const component = runInInjectionContext(injector, () => new PermissionsSectionComponent());
  return { component, injector, settings };
};

describe('PermissionsSectionComponent', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('stops the permission probe stream and refreshes permission state', async () => {
    const stop = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop }],
        }),
      },
    });
    const { component, injector, settings } = createComponent();

    await component.requestMicrophonePermission();

    expect(stop).toHaveBeenCalled();
    expect(settings.checkPermissions).toHaveBeenCalledTimes(1);
    injector.destroy();
  });

  it('refreshes notification permission state even when the browser denies the request', async () => {
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: {
        requestPermission: vi.fn().mockResolvedValue('denied'),
      },
    });
    vi.stubGlobal('Notification', window.Notification);
    const { component, injector, settings } = createComponent();

    await component.requestNotificationsPermission();

    expect(settings.checkPermissions).toHaveBeenCalledTimes(1);
    injector.destroy();
  });
});
