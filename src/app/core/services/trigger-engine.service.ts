import { Injectable } from '@angular/core';

import { ConfidenceLevel } from '../models/cue.model';
import {
  DetectionResult,
  Match,
  TriggerEngineSnapshot,
  TriggerState,
} from '../models/trigger.model';

/** Confidence below this value is always ignored, regardless of the cue's own threshold. */
const MIN_CONFIDENCE = 0.7;

/**
 * Decoupled from the UI: turns keyword matches into confidence-evaluated detections and derives
 * the engine's operational state (listening / matched / triggering / cooldown / ...). Keyword
 * matching and cooldown bookkeeping stay in `CueEngineService`; this service only evaluates
 * confidence and reports state so it stays a thin, easily testable layer.
 */
@Injectable({ providedIn: 'root' })
export class TriggerEngineService {
  /** Confidence Evaluation + Trigger Validation step of the detection pipeline. */
  evaluateConfidence(
    match: Match,
    confidence: number | undefined,
    threshold: number,
  ): DetectionResult {
    const level = this.confidenceLevel(confidence, threshold);
    const allowed = !(match.action === 'play' && level === 'low');
    return { match, confidence, level, allowed };
  }

  confidenceLevel(confidence: number | undefined, threshold: number): ConfidenceLevel {
    if (confidence === undefined) return 'unknown';
    if (confidence >= threshold) return 'high';
    if (confidence >= MIN_CONFIDENCE) return 'medium';
    return 'low';
  }

  /** Priority order: error > triggering > matched > cooldown > detecting > initializing > listening > paused > idle. */
  deriveState(snapshot: TriggerEngineSnapshot): TriggerState {
    if (snapshot.error) return 'error';
    if (snapshot.triggering) return 'triggering';
    if (snapshot.matched) return 'matched';
    if (snapshot.cooldownActive) return 'cooldown';
    if (snapshot.detecting) return 'detecting';
    if (snapshot.initializing) return 'initializing';
    if (snapshot.listening) return 'listening';
    if (snapshot.paused) return 'paused';
    return 'idle';
  }

  cooldownRemainingMs(expiresAt: number | undefined, now: number): number {
    return expiresAt ? Math.max(0, expiresAt - now) : 0;
  }
}
