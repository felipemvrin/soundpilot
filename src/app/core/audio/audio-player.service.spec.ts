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
  beforeEach(() => {
    vi.stubGlobal(
      'Audio',
      class {
        volume = 1;
        currentTime = 0;
        play = vi.fn().mockResolvedValue(undefined);
        pause = vi.fn();
        addEventListener = vi.fn();
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
});
