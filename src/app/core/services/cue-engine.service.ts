import { Injectable, inject } from '@angular/core';
import { Subject } from 'rxjs';

import { Cue, CueAction, CueEvent, TranscriptEvent } from '../models/cue.model';
import { TextNormalizerService } from './text-normalizer.service';

@Injectable({ providedIn: 'root' })
export class CueEngineService {
  private readonly normalizer = inject(TextNormalizerService);
  private readonly lastTriggeredAt = new Map<string, number>();
  private readonly cueDetectedSubject = new Subject<CueEvent>();

  readonly cueDetected$ = this.cueDetectedSubject.asObservable();

  processTranscript(transcript: TranscriptEvent, cues: readonly Cue[]): CueEvent[] {
    const normalizedTranscript = this.normalizer.normalize(transcript.text);
    if (!normalizedTranscript) {
      return [];
    }

    const events = cues
      .filter((cue) => cue.enabled)
      .flatMap((cue) => {
        const matchingTrigger = [...cue.triggers]
          .sort((left, right) => right.value.length - left.value.length)
          .find((trigger) => this.matches(normalizedTranscript, trigger.value));

        if (!matchingTrigger || this.isCoolingDown(cue, transcript.timestamp)) {
          return [];
        }

        this.lastTriggeredAt.set(cue.id, transcript.timestamp);
        const event: CueEvent = {
          cue,
          trigger: matchingTrigger,
          action: this.actionFor(cue.mode),
          transcript,
          timestamp: transcript.timestamp,
        };
        this.cueDetectedSubject.next(event);
        return [event];
      });

    return events;
  }

  private matches(normalizedTranscript: string, trigger: string): boolean {
    const normalizedTrigger = this.normalizer.normalize(trigger);
    if (!normalizedTrigger) {
      return false;
    }
    return new RegExp(`(?:^|\\s)${this.escapeForRegExp(normalizedTrigger)}(?:$|\\s)`, 'u').test(
      normalizedTranscript,
    );
  }

  private isCoolingDown(cue: Cue, timestamp: number): boolean {
    const lastTimestamp = this.lastTriggeredAt.get(cue.id);
    return lastTimestamp !== undefined && timestamp - lastTimestamp < cue.cooldownMs;
  }

  private actionFor(mode: Cue['mode']): CueAction {
    return mode === 'automatic' ? 'play' : mode === 'confirm' ? 'confirm' : 'display';
  }

  private escapeForRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
