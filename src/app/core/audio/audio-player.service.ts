import { Injectable, Optional, signal } from '@angular/core';
import { Subject } from 'rxjs';

import { AudioPlaybackEvent, Cue, NowPlaying } from '../models/cue.model';
import { SettingsService } from '../services/settings.service';

@Injectable({ providedIn: 'root' })
export class AudioPlayerService {
  private readonly players = new Map<string, HTMLAudioElement>();
  private readonly cueVolumes = new Map<string, number>();
  private readonly playbackSubject = new Subject<AudioPlaybackEvent>();
  private masterVolume = 1;
  private lastCue?: Cue;

  constructor(@Optional() private readonly settings: SettingsService | null = null) {}

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
    this.cueVolumes.set(cue.id, cue.volume);
    try {
      await this.applyOutputDevice(player);
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
      this.cueVolumes.delete(cue.id);
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
    this.cueVolumes.delete(cueId);
    this.clearNowPlaying(cueId);
    this.emit(cueId, 'stopped');
  }

  stopAll(): void {
    [...this.players.keys()].forEach((cueId) => this.stop(cueId));
  }

  setMasterVolume(volume: number): void {
    this.masterVolume = this.clamp(volume);
    this.players.forEach((player, cueId) => {
      player.volume = this.clamp((this.cueVolumes.get(cueId) ?? 1) * this.masterVolume);
    });
  }

  getMasterVolume(): number {
    return this.masterVolume;
  }

  private handleEnded(cueId: string): void {
    this.players.delete(cueId);
    this.cueVolumes.delete(cueId);
    this.clearNowPlaying(cueId);
    this.emit(cueId, 'ended');
  }

  private clearNowPlaying(cueId: string): void {
    if (this.nowPlaying()?.cueId === cueId) this.nowPlaying.set(undefined);
  }

  private emit(cueId: string, type: AudioPlaybackEvent['type']): void {
    this.playbackSubject.next({ cueId, type, timestamp: Date.now() });
  }

  private async applyOutputDevice(player: HTMLAudioElement): Promise<void> {
    const deviceId = this.settings?.settings().audio.outputDevice?.id;
    if (!deviceId) return;

    const sinkAwarePlayer = player as HTMLAudioElement & {
      setSinkId?: (sinkId: string) => Promise<void>;
    };
    if (typeof sinkAwarePlayer.setSinkId !== 'function') return;

    try {
      await sinkAwarePlayer.setSinkId(deviceId);
    } catch {
      // Fall back to the browser default output device
    }
  }

  private clamp(value: number): number {
    return Math.min(1, Math.max(0, value));
  }
}
