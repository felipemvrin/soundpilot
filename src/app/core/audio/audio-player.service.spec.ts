import { signal } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Cue } from '../models/cue.model';
import { DEFAULT_SETTINGS } from '../models/settings.model';
import { SettingsService } from '../services/settings.service';
import { AudioPlayerService } from './audio-player.service';

const cue: Cue = {
  id: 'cue',
  name: 'Cue',
  triggers: [],
  audioFile: 'sound.mp3',
  mode: 'automatic',
  enabled: true,
  cooldownMs: 0,
  volume: 0.5,
  priority: 'normal',
};

describe('AudioPlayerService', () => {
  let playResult!: () => Promise<void>;
  const created: Array<{
    volume: number;
    currentTime: number;
    play: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
    addEventListener: ReturnType<typeof vi.fn>;
    setSinkId: ReturnType<typeof vi.fn>;
  }> = [];

  beforeEach(() => {
    created.length = 0;
    playResult = () => Promise.resolve();
    vi.stubGlobal(
      'Audio',
      class {
        volume = 1;
        currentTime = 0;
        play = vi.fn().mockImplementation(() => playResult());
        pause = vi.fn();
        addEventListener = vi.fn();
        setSinkId = vi.fn().mockResolvedValue(undefined);

        constructor() {
          created.push(this);
        }
      },
    );
  });

  it('plays configured audio and emits an event', async () => {
    const service = new AudioPlayerService();
    const events: string[] = [];
    service.playback$.subscribe((event) => events.push(event.type));
    await expect(service.play(cue)).resolves.toBe('played');
    expect(events).toEqual(['played']);
  });

  it('reports an error when no audio file is assigned', async () => {
    const service = new AudioPlayerService();
    const events: string[] = [];
    service.playback$.subscribe((event) => events.push(event.type));
    await expect(service.play({ ...cue, audioFile: '' })).resolves.toBe('error');
    expect(events).toEqual(['error']);
  });

  it('reports the browser playback rejection reason', async () => {
    const service = new AudioPlayerService();
    const events: string[] = [];
    service.playback$.subscribe((event) => {
      if (event.error) events.push(event.error);
    });
    const rejection = new DOMException('Playback was blocked', 'NotAllowedError');
    playResult = () => Promise.reject(rejection);

    await expect(service.play(cue)).resolves.toBe('error');
    expect(events).toEqual(['NotAllowedError']);
  });

  it('updates active playback volume when master volume changes', async () => {
    const service = new AudioPlayerService();
    await expect(service.play(cue)).resolves.toBe('played');
    service.setMasterVolume(0.2);
    expect(created[0]?.volume).toBeCloseTo(0.1);
  });

  it('keeps only the newest audio active when a second cue starts', async () => {
    const service = new AudioPlayerService();
    const secondCue = { ...cue, id: 'cue-2', audioFile: 'sound-2.mp3', volume: 0.8 };
    await expect(service.play(cue)).resolves.toBe('played');
    await expect(service.play(secondCue)).resolves.toBe('played');
    expect(created).toHaveLength(2);
    expect(created[0]?.volume).toBe(0);
    expect(created[0]?.pause).toHaveBeenCalled();
    expect(created[1]?.volume).toBeCloseTo(0.8);
    expect(service.nowPlaying()?.cueId).toBe('cue-2');
  });

  it('fades the current audio to zero before starting the next cue', async () => {
    const settings = signal({
      ...DEFAULT_SETTINGS,
      playback: { ...DEFAULT_SETTINGS.playback, fadeOutMs: 30 },
    });
    const service = new AudioPlayerService({ settings } as SettingsService);
    await expect(service.play(cue)).resolves.toBe('played');
    const firstPlayer = created[0];
    const secondCue = { ...cue, id: 'cue-2', audioFile: 'sound-2.mp3' };
    const nextPlay = service.play(secondCue);

    await expect(nextPlay).resolves.toBe('played');
    expect(firstPlayer?.volume).toBe(0);
  });

  it('fades out instead of stopping abruptly', async () => {
    const settings = signal({
      ...DEFAULT_SETTINGS,
      playback: { ...DEFAULT_SETTINGS.playback, fadeOutMs: 30 },
    });
    const service = new AudioPlayerService({ settings } as SettingsService);
    await expect(service.play(cue)).resolves.toBe('played');
    const player = created[0];

    service.stop(cue.id);
    expect(player?.pause).not.toHaveBeenCalled();
    expect(player?.volume).toBeGreaterThan(0);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(player?.volume).toBe(0);
    expect(player?.pause).toHaveBeenCalled();
  });

  it('applies the selected output device when the browser supports sink selection', async () => {
    const service = new AudioPlayerService({
      settings: signal({
        ...DEFAULT_SETTINGS,
        audio: {
          ...DEFAULT_SETTINGS.audio,
          outputDevice: { id: 'speaker-1', label: 'Studio Monitor' },
        },
      }),
    } as SettingsService);

    await expect(service.play(cue)).resolves.toBe('played');

    expect(created[0]?.setSinkId).toHaveBeenCalledWith('speaker-1');
  });
});
