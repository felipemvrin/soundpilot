import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Cue } from '../models/cue.model';
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
  const created: Array<{
    volume: number;
    currentTime: number;
    play: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
    addEventListener: ReturnType<typeof vi.fn>;
  }> = [];

  beforeEach(() => {
    created.length = 0;
    vi.stubGlobal(
      'Audio',
      class {
        volume = 1;
        currentTime = 0;
        play = vi.fn().mockResolvedValue(undefined);
        pause = vi.fn();
        addEventListener = vi.fn();

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

  it('updates active playback volume when master volume changes', async () => {
    const service = new AudioPlayerService();
    await expect(service.play(cue)).resolves.toBe('played');
    service.setMasterVolume(0.2);
    expect(created[0]?.volume).toBeCloseTo(0.1);
  });

  it('updates all active players when master volume changes', async () => {
    const service = new AudioPlayerService();
    const secondCue = { ...cue, id: 'cue-2', audioFile: 'sound-2.mp3', volume: 0.8 };
    await expect(service.play(cue)).resolves.toBe('played');
    await expect(service.play(secondCue)).resolves.toBe('played');
    service.setMasterVolume(0.25);
    expect(created[0]?.volume).toBeCloseTo(0.125);
    expect(created[1]?.volume).toBeCloseTo(0.2);
  });
});
