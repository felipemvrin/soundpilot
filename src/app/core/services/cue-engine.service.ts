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

    const candidates = cues
      .filter((cue) => cue.enabled)
      .flatMap((cue) => {
        const matchingTrigger = [...cue.triggers]
          .sort((left, right) => right.value.length - left.value.length)
          .find((trigger) => this.matches(normalizedTranscript, trigger.value));

        if (!matchingTrigger || this.isCoolingDown(cue, transcript.timestamp)) return [];
        return [
          {
            cue,
            trigger: matchingTrigger,
            action: this.actionFor(cue.mode),
            transcript,
            timestamp: transcript.timestamp,
          },
        ];
      });

    const [winner] = candidates.sort((left, right) => this.compareCandidates(left, right));
    if (!winner) return [];
    this.lastTriggeredAt.set(winner.cue.id, transcript.timestamp);
    this.cueDetectedSubject.next(winner);
    return [winner];
  }

  private compareCandidates(left: CueEvent, right: CueEvent): number {
    const triggerSpecificity =
      this.normalizer.normalize(right.trigger.value).length -
      this.normalizer.normalize(left.trigger.value).length;
    if (triggerSpecificity !== 0) return triggerSpecificity;

    const priority = { high: 3, normal: 2, low: 1 } as const;
    const priorityDifference = priority[right.cue.priority] - priority[left.cue.priority];
    if (priorityDifference !== 0) return priorityDifference;
    return left.cue.id.localeCompare(right.cue.id);
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
