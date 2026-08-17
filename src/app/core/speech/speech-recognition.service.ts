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
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecognitionConstructor = new () => RecognitionLike;

@Injectable({ providedIn: 'root' })
export class SpeechRecognitionService {
  readonly available = signal(this.getConstructor() !== undefined);
  readonly isRecognizing = signal(false);
  private readonly transcriptSubject = new Subject<TranscriptEvent>();
  private recognition?: RecognitionLike;

  readonly transcript$ = this.transcriptSubject.asObservable();

  start(): void {
    const Recognition = this.getConstructor();
    if (!Recognition || this.isRecognizing()) return;
    this.recognition = new Recognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'es-ES';
    this.recognition.onresult = (event) => this.handleResult(event);
    this.recognition.onend = () => this.isRecognizing.set(false);
    this.recognition.onerror = () => this.isRecognizing.set(false);
    this.recognition.start();
    this.isRecognizing.set(true);
  }

  stop(): void {
    this.recognition?.stop();
    this.recognition = undefined;
    this.isRecognizing.set(false);
  }

  private handleResult(event: RecognitionEventLike): void {
    const result = event.results[event.resultIndex];
    const alternative = result?.[0];
    if (!alternative || !result) return;
    this.transcriptSubject.next({
      text: alternative.transcript,
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
