import { Injectable, Optional, signal } from '@angular/core';

import { SettingsService } from '../services/settings.service';

/** Number of frequency bands exposed for per-bar waveform visualizers (e.g. LIVE LISTENING). */
const BAND_COUNT = 14;

@Injectable({ providedIn: 'root' })
export class MicrophoneService {
  readonly isListening = signal(false);
  readonly level = signal(0);
  /** Real per-band frequency levels (0-1), sized `BAND_COUNT`, for waveform bar visualizers. */
  readonly bands = signal<readonly number[]>([]);
  private stream?: MediaStream;
  private audioContext?: AudioContext;
  private analyser?: AnalyserNode;
  private animationFrame?: number;

  constructor(@Optional() private readonly settings: SettingsService | null = null) {}

  async start(): Promise<void> {
    if (this.isListening()) return;
    this.stream = await this.getStream();
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
    this.bands.set([]);
    this.isListening.set(false);
  }

  private monitorLevel(): void {
    if (!this.analyser || !this.isListening()) return;
    const timeData = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteTimeDomainData(timeData);
    const sum = timeData.reduce((total, sample) => total + Math.abs(sample - 128), 0);
    this.level.set(Math.min(1, sum / timeData.length / 48));

    const freqData = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(freqData);
    this.bands.set(this.toBands(freqData));

    this.animationFrame = requestAnimationFrame(() => this.monitorLevel());
  }

  private async getStream(): Promise<MediaStream> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Audio input is not available in this browser.');
    }

    const deviceId = this.settings?.settings().audio.inputDevice?.id;
    if (!deviceId) {
      return navigator.mediaDevices.getUserMedia({ audio: true });
    }

    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: { exact: deviceId },
        },
      });
    } catch {
      return navigator.mediaDevices.getUserMedia({ audio: true });
    }
  }

  private toBands(data: Uint8Array): number[] {
    const bandSize = Math.max(1, Math.floor(data.length / BAND_COUNT));
    const bands: number[] = [];
    for (let index = 0; index < BAND_COUNT; index += 1) {
      const start = index * bandSize;
      const end = index === BAND_COUNT - 1 ? data.length : start + bandSize;
      let total = 0;
      for (let bin = start; bin < end; bin += 1) total += data[bin];
      bands.push(end > start ? Math.min(1, total / (end - start) / 255) : 0);
    }
    return bands;
  }
}
