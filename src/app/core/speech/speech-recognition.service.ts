import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';

import { TranscriptEvent } from '../models/cue.model';

interface RecognitionResultItem {
  transcript: string;
  confidence: number;
}
interface RecognitionResultSet {
  isFinal: boolean;
  0: RecognitionResultItem;
}
interface RecognitionEventLike extends Event {
  resultIndex: number;
  results: ArrayLike<RecognitionResultSet>;
}
interface RecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event?: { error?: string }) => void) | null;
  start(): void;
  stop(): void;
}
type RecognitionConstructor = new () => RecognitionLike;

@Injectable({ providedIn: 'root' })
export class SpeechRecognitionService {
  readonly available = signal(this.getConstructor() !== undefined);
  readonly isRecognizing = signal(false);
  readonly language = signal('es-ES');
  private readonly transcriptSubject = new Subject<TranscriptEvent>();
  private recognition?: RecognitionLike;
  private shouldRestart = false;
  private restartAttempts = 0;
  private readonly MAX_RESTART_ATTEMPTS = 5;
  private lastFinalTranscript?: string;
  private lastFinalAt = 0;
  private resultTexts: string[] = [];
  private accumulatedTranscript = '';

  readonly transcript$ = this.transcriptSubject.asObservable();

  start(): void {
    const Recognition = this.getConstructor();
    if (!Recognition || this.isRecognizing()) return;
    this.shouldRestart = true;
    this.resultTexts = [];
    this.recognition = new Recognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = this.language();
    this.recognition.onresult = (event) => {
      this.restartAttempts = 0;
      this.handleResult(event);
    };
    this.recognition.onend = () => {
      const currentText = this.resultTexts.filter(Boolean).join(' ').trim();
      if (currentText) {
        this.accumulatedTranscript = [this.accumulatedTranscript, currentText]
          .filter(Boolean)
          .join(' ')
          .trim();
      }
      this.isRecognizing.set(false);
      if (this.shouldRestart && this.restartAttempts < this.MAX_RESTART_ATTEMPTS) {
        this.restartAttempts++;
        queueMicrotask(() => this.start());
      }
    };
    this.recognition.onerror = (event) => {
      this.isRecognizing.set(false);
      if (event?.error === 'not-allowed' || event?.error === 'service-not-allowed') {
        this.shouldRestart = false;
      }
    };
    try {
      this.recognition.start();
      this.isRecognizing.set(true);
    } catch {
      this.isRecognizing.set(false);
      this.shouldRestart = false;
    }
  }

  stop(): void {
    this.shouldRestart = false;
    this.restartAttempts = 0;
    this.recognition?.stop();
    this.recognition = undefined;
    this.resultTexts = [];
    this.accumulatedTranscript = '';
    this.isRecognizing.set(false);
  }

  private handleResult(event: RecognitionEventLike): void {
    const changedResult = event.results[event.resultIndex];
    const alternative = changedResult?.[0];
    if (!alternative || !changedResult) return;

    for (let index = 0; index < event.results.length; index += 1) {
      const result = event.results[index];
      const item = result?.[0];
      if (item) this.resultTexts[index] = item.transcript.trim();
    }
    const currentText = this.resultTexts.filter(Boolean).join(' ').trim();
    const text = [this.accumulatedTranscript, currentText].filter(Boolean).join(' ').trim();
    const segmentText = alternative.transcript.trim();
    if (changedResult.isFinal) {
      const now = Date.now();
      if (text === this.lastFinalTranscript && now - this.lastFinalAt < 1_000) return;
      this.lastFinalTranscript = text;
      this.lastFinalAt = now;
    }
    this.transcriptSubject.next({
      text,
      segmentText,
      confidence: alternative.confidence,
      timestamp: Date.now(),
      isFinal: changedResult.isFinal,
    });
  }

  private getConstructor(): RecognitionConstructor | undefined {
    const scope = window as Window & {
      SpeechRecognition?: RecognitionConstructor;
      webkitSpeechRecognition?: RecognitionConstructor;
    };
    return scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
  }
}
