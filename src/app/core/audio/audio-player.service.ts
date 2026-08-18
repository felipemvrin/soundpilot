import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';

import { AudioPlaybackEvent, Cue, NowPlaying } from '../models/cue.model';

@Injectable({ providedIn: 'root' })
export class AudioPlayerService {
  private readonly players = new Map<string, HTMLAudioElement>();
  private readonly playbackSubject = new Subject<AudioPlaybackEvent>();
  private masterVolume = 1;
  private lastCue?: Cue;

  readonly playback$ = this.playbackSubject.asObservable();
  readonly nowPlaying = signal<NowPlaying | undefined>(undefined);
  readonly lastPlayed = signal<{ cueId: string; cueName: string; timestamp: number } | undefined>(
    undefined,
  );

  async play(cue: Cue): Promise<'played' | 'error'> {
    if (!cue.audioFile) {
      this.emit(cue.id, 'error');
      return 'error';
    }
    const player = new Audio(cue.audioFile);
    player.volume = this.clamp(cue.volume * this.masterVolume);
    player.addEventListener('ended', () => this.handleEnded(cue.id), { once: true });
    this.players.set(cue.id, player);
    try {
      await player.play();
      const timestamp = Date.now();
      this.lastCue = cue;
      this.nowPlaying.set({
        cueId: cue.id,
        cueName: cue.name,
        audioFile: cue.audioName ?? cue.audioFile,
        startedAt: timestamp,
      });
      this.lastPlayed.set({ cueId: cue.id, cueName: cue.name, timestamp });
      this.emit(cue.id, 'played');
      return 'played';
    } catch {
      this.players.delete(cue.id);
      this.emit(cue.id, 'error');
      return 'error';
    }
  }

  /** Replays the last cue that actually started playing. */
  async replayLast(): Promise<'played' | 'error' | 'unavailable'> {
    if (!this.lastCue) return 'unavailable';
    return this.play(this.lastCue);
  }

  stop(cueId: string): void {
    const player = this.players.get(cueId);
    if (!player) return;
    player.pause();
    player.currentTime = 0;
    this.players.delete(cueId);
    this.clearNowPlaying(cueId);
    this.emit(cueId, 'stopped');
  }

  stopAll(): void {
    [...this.players.keys()].forEach((cueId) => this.stop(cueId));
  }

  setMasterVolume(volume: number): void {
    this.masterVolume = this.clamp(volume);
  }

  getMasterVolume(): number {
    return this.masterVolume;
  }

  private handleEnded(cueId: string): void {
    this.players.delete(cueId);
    this.clearNowPlaying(cueId);
    this.emit(cueId, 'ended');
  }

  private clearNowPlaying(cueId: string): void {
    if (this.nowPlaying()?.cueId === cueId) this.nowPlaying.set(undefined);
  }

  private emit(cueId: string, type: AudioPlaybackEvent['type']): void {
    this.playbackSubject.next({ cueId, type, timestamp: Date.now() });
  }

  private clamp(value: number): number {
    return Math.min(1, Math.max(0, value));
  }
}
