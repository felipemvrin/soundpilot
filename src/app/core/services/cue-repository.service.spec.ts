import { beforeEach, describe, expect, it } from 'vitest';

import { CueRepository } from './cue-repository.service';

describe('CueRepository', () => {
  beforeEach(() => localStorage.clear());

  it('migrates legacy singular triggers without losing the cue configuration', () => {
    localStorage.setItem(
      'soundpilot.cues.v1',
      JSON.stringify([
        {
          id: 'legacy',
          name: 'ESPOSA',
          trigger: 'esposa',
          audioFile: 'sound.mp3',
          enabled: true,
          mode: 'automatic',
          cooldownMs: 3000,
          volume: 1,
          priority: 'normal',
        },
      ]),
    );

    const cue = new CueRepository().load()[0];
    expect(cue.triggers).toHaveLength(1);
    expect(cue.triggers[0]?.value).toBe('esposa');
    expect(cue.confidenceThreshold).toBeUndefined();
  });

  it('persists multi-trigger cue settings across a reload', () => {
    const repository = new CueRepository();
    const cues = [
      {
        id: 'cue',
        name: 'FAMILIA',
        triggers: [
          { id: 'one', value: 'familia' },
          { id: 'two', value: 'mi familia' },
        ],
        audioFile: 'data:audio/wav;base64,AA==',
        audioName: 'familia.wav',
        mode: 'confirm' as const,
        enabled: false,
        cooldownMs: 2500,
        volume: 1,
        priority: 'normal' as const,
        confidenceThreshold: 0.86,
        shortcut: 'F2',
      },
    ];

    repository.save(cues);
    expect(new CueRepository().load()).toEqual(cues);
  });

  it('sanitizes invalid legacy values while loading cues', () => {
    localStorage.setItem(
      'soundpilot.cues.v1',
      JSON.stringify([
        {
          id: 'legacy-invalid',
          name: 'LEGACY',
          triggers: [{ id: 'one', value: 'legacy trigger' }],
          audioFile: { bad: true },
          audioName: 123,
          mode: 'unexpected',
          enabled: 'yes',
          cooldownMs: 1000,
          volume: 1,
          priority: 'unexpected',
          confidenceThreshold: 3,
          shortcut: 'f10',
        },
      ]),
    );

    expect(new CueRepository().load()).toEqual([
      {
        id: 'legacy-invalid',
        name: 'LEGACY',
        triggers: [{ id: 'one', value: 'legacy trigger' }],
        audioFile: '',
        audioName: undefined,
        mode: 'automatic',
        enabled: true,
        cooldownMs: 1000,
        volume: 1,
        priority: 'normal',
        confidenceThreshold: undefined,
        shortcut: undefined,
      },
    ]);
  });
});
