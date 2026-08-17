import { Injectable } from '@angular/core';

import { Cue } from '../models/cue.model';

const STORAGE_KEY = 'soundpilot.cues.v1';

@Injectable({ providedIn: 'root' })
export class CueRepository {
  load(): Cue[] {
    const rawValue = localStorage.getItem(STORAGE_KEY);
    if (!rawValue) {
      return [];
    }
    try {
      const parsed: unknown = JSON.parse(rawValue);
      return Array.isArray(parsed) ? (parsed as Cue[]) : [];
    } catch {
      return [];
    }
  }

  save(cues: readonly Cue[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cues));
  }
}
