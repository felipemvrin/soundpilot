import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

import { AudioPlaybackEvent, Cue } from '../models/cue.model';

@Injectable({ providedIn: 'root' })
export class AudioPlayerService {
  private readonly players = new Map<string, HTMLAudioElement>();
  private readonly playbackSubject = new Subject<AudioPlaybackEvent>();
  private masterVolume = 1;

  readonly playback$ = this.playbackSubject.asObservable();

  async play(cue: Cue): Promise<void> {
    if (!cue.audioFile) {
      this.emit(cue.id, 'error');
      return;
    }
    const player = new Audio(cue.audioFile);
    player.volume = this.clamp(cue.volume * this.masterVolume);
    player.addEventListener('ended', () => this.players.delete(cue.id), { once: true });
    this.players.set(cue.id, player);
    try {
      await player.play();
      this.emit(cue.id, 'played');
    } catch {
      this.players.delete(cue.id);
      this.emit(cue.id, 'error');
    }
  }

  stop(cueId: string): void {
    const player = this.players.get(cueId);
    if (!player) return;
    player.pause();
    player.currentTime = 0;
    this.players.delete(cueId);
    this.emit(cueId, 'stopped');
  }

  stopAll(): void {
    [...this.players.keys()].forEach((cueId) => this.stop(cueId));
  }

  setMasterVolume(volume: number): void {
    this.masterVolume = this.clamp(volume);
  }

  private emit(cueId: string, type: AudioPlaybackEvent['type']): void {
    this.playbackSubject.next({ cueId, type, timestamp: Date.now() });
  }

  private clamp(value: number): number {
    return Math.min(1, Math.max(0, value));
  }
}
