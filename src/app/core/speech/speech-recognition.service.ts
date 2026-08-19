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
  private lastFinalTranscript?: string;
  private lastFinalAt = 0;

  readonly transcript$ = this.transcriptSubject.asObservable();

  start(): void {
    const Recognition = this.getConstructor();
    if (!Recognition || this.isRecognizing()) return;
    this.shouldRestart = true;
    this.recognition = new Recognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = this.language();
    this.recognition.onresult = (event) => this.handleResult(event);
    this.recognition.onend = () => {
      this.isRecognizing.set(false);
      if (this.shouldRestart) queueMicrotask(() => this.start());
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
    this.recognition?.stop();
    this.recognition = undefined;
    this.isRecognizing.set(false);
  }

  private handleResult(event: RecognitionEventLike): void {
    const result = event.results[event.resultIndex];
    const alternative = result?.[0];
    if (!alternative || !result) return;
    const text = alternative.transcript.trim();
    if (result.isFinal) {
      const now = Date.now();
      if (text === this.lastFinalTranscript && now - this.lastFinalAt < 1_000) return;
      this.lastFinalTranscript = text;
      this.lastFinalAt = now;
    }
    this.transcriptSubject.next({
      text,
      confidence: alternative.confidence,
      timestamp: Date.now(),
      isFinal: result.isFinal,
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
