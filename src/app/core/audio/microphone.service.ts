import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class MicrophoneService {
  readonly isListening = signal(false);
  readonly level = signal(0);
  private stream?: MediaStream;
  private audioContext?: AudioContext;
  private analyser?: AnalyserNode;
  private animationFrame?: number;

  async start(): Promise<void> {
    if (this.isListening()) return;
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.audioContext = new AudioContext();
    await this.audioContext.resume();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.audioContext.createMediaStreamSource(this.stream).connect(this.analyser);
    this.isListening.set(true);
    this.monitorLevel();
  }

  stop(): void {
    if (this.animationFrame !== undefined) cancelAnimationFrame(this.animationFrame);
    this.stream?.getTracks().forEach((track) => track.stop());
    void this.audioContext?.close();
    this.stream = undefined;
    this.audioContext = undefined;
    this.analyser = undefined;
    this.level.set(0);
    this.isListening.set(false);
  }

  private monitorLevel(): void {
    if (!this.analyser || !this.isListening()) return;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(data);
    const sum = data.reduce((total, sample) => total + Math.abs(sample - 128), 0);
    this.level.set(Math.min(1, sum / data.length / 48));
    this.animationFrame = requestAnimationFrame(() => this.monitorLevel());
  }
}
