import { Injectable } from '@angular/core';

import { Cue } from '../models/cue.model';

const STORAGE_KEY = 'soundpilot.cues.v1';

type LegacyCue = Partial<Cue> & { trigger?: string };

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
      audioFile: cue.audioFile ?? '',
      audioName: cue.audioName,
      mode: cue.mode ?? 'automatic',
      enabled: cue.enabled ?? true,
      cooldownMs: typeof cooldownMs === 'number' && Number.isFinite(cooldownMs) ? cooldownMs : 3000,
      volume: typeof volume === 'number' && Number.isFinite(volume) ? volume : 1,
      priority: cue.priority ?? 'normal',
      confidenceThreshold: Number.isFinite(cue.confidenceThreshold)
        ? cue.confidenceThreshold
        : undefined,
      shortcut: cue.shortcut,
    };
  }
}
