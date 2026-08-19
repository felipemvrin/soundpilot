import { Injectable } from '@angular/core';

import { Cue, CueMode, CuePriority } from '../models/cue.model';

const STORAGE_KEY = 'soundpilot.cues.v1';

type LegacyCue = Partial<Cue> & { trigger?: string };
const CUE_MODES: readonly CueMode[] = ['automatic', 'confirm', 'manual'];
const CUE_PRIORITIES: readonly CuePriority[] = ['low', 'normal', 'high'];

@Injectable({ providedIn: 'root' })
export class CueRepository {
  load(): Cue[] {
    const rawValue = localStorage.getItem(STORAGE_KEY);
    if (!rawValue) {
      return [];
    }
    try {
      const parsed: unknown = JSON.parse(rawValue);
      return Array.isArray(parsed) ? parsed.map((cue) => this.migrateCue(cue as LegacyCue)) : [];
    } catch {
      return [];
    }
  }

  save(cues: readonly Cue[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cues));
  }

  private migrateCue(cue: LegacyCue): Cue {
    const legacyTrigger = typeof cue.trigger === 'string' ? cue.trigger.trim() : '';
    const cooldownMs = cue.cooldownMs;
    const volume = cue.volume;
    const confidenceThreshold = cue.confidenceThreshold;
    const shortcut =
      typeof cue.shortcut === 'string' && /^f[1-9]$/i.test(cue.shortcut)
        ? cue.shortcut.toUpperCase()
        : undefined;
    const mode: CueMode =
      typeof cue.mode === 'string' && CUE_MODES.includes(cue.mode as CueMode)
        ? (cue.mode as CueMode)
        : 'automatic';
    const priority: CuePriority =
      typeof cue.priority === 'string' && CUE_PRIORITIES.includes(cue.priority as CuePriority)
        ? (cue.priority as CuePriority)
        : 'normal';
    const triggers = Array.isArray(cue.triggers)
      ? cue.triggers.filter(
          (trigger): trigger is { id: string; value: string } =>
            typeof trigger?.id === 'string' && typeof trigger.value === 'string',
        )
      : legacyTrigger
        ? [{ id: crypto.randomUUID(), value: legacyTrigger }]
        : [];

    return {
      id: cue.id ?? crypto.randomUUID(),
      name: cue.name ?? '',
      triggers,
      audioFile: typeof cue.audioFile === 'string' ? cue.audioFile : '',
      audioName: typeof cue.audioName === 'string' ? cue.audioName : undefined,
      mode,
      enabled: typeof cue.enabled === 'boolean' ? cue.enabled : true,
      cooldownMs: typeof cooldownMs === 'number' && Number.isFinite(cooldownMs) ? cooldownMs : 3000,
      volume: typeof volume === 'number' && Number.isFinite(volume) ? volume : 1,
      priority,
      confidenceThreshold:
        Number.isFinite(confidenceThreshold) &&
        confidenceThreshold !== undefined &&
        confidenceThreshold >= 0 &&
        confidenceThreshold <= 1
          ? confidenceThreshold
          : undefined,
      shortcut,
    };
  }
}
