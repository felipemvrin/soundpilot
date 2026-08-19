import { Injectable, Optional, signal } from '@angular/core';
import { Subject } from 'rxjs';

import { AudioPlaybackEvent, Cue, NowPlaying } from '../models/cue.model';
import { SettingsService } from '../services/settings.service';
import { AudioEnginePort } from './audio-engine.port';

@Injectable({ providedIn: 'root' })
export class AudioPlayerService implements AudioEnginePort {
  private readonly players = new Map<string, HTMLAudioElement>();
  private readonly cueVolumes = new Map<string, number>();
  private readonly fadeTimers = new Set<ReturnType<typeof setTimeout>>();
  private readonly playbackSubject = new Subject<AudioPlaybackEvent>();
  private masterVolume = 1;
  private lastCue?: Cue;
  private transitionId = 0;

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
    const transitionId = ++this.transitionId;
    this.cancelFades();
    await this.fadeOutActivePlayers(transitionId);
    if (transitionId !== this.transitionId) return 'error';

    const player = new Audio(cue.audioFile);
    const targetVolume = this.clamp(cue.volume * this.masterVolume);
    player.volume = 0;
    player.addEventListener('ended', () => this.handleEnded(cue.id), { once: true });
    this.players.set(cue.id, player);
    this.cueVolumes.set(cue.id, cue.volume);
    try {
      await this.applyOutputDevice(player);
      await player.play();
      await this.fadeVolume(player, targetVolume, this.fadeInDurationMs(), transitionId);
      if (transitionId !== this.transitionId) return 'error';
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
    } catch (error) {
      this.players.delete(cue.id);
      this.cueVolumes.delete(cue.id);
      this.emit(cue.id, 'error', this.errorMessage(error));
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
    const transitionId = ++this.transitionId;
    this.cancelFades();
    void this.fadeVolume(player, 0, this.fadeOutDurationMs(), transitionId).then(() => {
      if (transitionId !== this.transitionId) return;
      this.removePlayer(cueId, player);
      this.clearNowPlaying(cueId);
      this.emit(cueId, 'stopped');
    });
  }

  stopAll(): void {
    const transitionId = ++this.transitionId;
    this.cancelFades();
    [...this.players.entries()].forEach(([cueId, player]) => {
      void this.fadeVolume(player, 0, this.fadeOutDurationMs(), transitionId).then(() => {
        if (transitionId !== this.transitionId) return;
        this.removePlayer(cueId, player);
        this.clearNowPlaying(cueId);
        this.emit(cueId, 'stopped');
      });
    });
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
    const player = this.players.get(cueId);
    if (player) this.removePlayer(cueId, player);
    this.clearNowPlaying(cueId);
    this.emit(cueId, 'ended');
  }

  private async fadeOutActivePlayers(transitionId: number): Promise<void> {
    const activePlayers = [...this.players.entries()];
    await Promise.all(
      activePlayers.map(async ([cueId, player]) => {
        await this.fadeVolume(player, 0, this.fadeOutDurationMs(), transitionId);
        if (transitionId !== this.transitionId) return;
        this.removePlayer(cueId, player);
        this.clearNowPlaying(cueId);
        this.emit(cueId, 'ended');
      }),
    );
  }

  private async fadeVolume(
    player: HTMLAudioElement,
    target: number,
    durationMs: number,
    transitionId: number,
  ): Promise<void> {
    const start = player.volume;
    if (durationMs <= 0 || Math.abs(target - start) < 0.001) {
      player.volume = target;
      return;
    }
    const startedAt = Date.now();
    await new Promise<void>((resolve) => {
      const step = (): void => {
        if (transitionId !== this.transitionId) {
          resolve();
          return;
        }
        const progress = Math.min(1, (Date.now() - startedAt) / durationMs);
        player.volume = this.clamp(start + (target - start) * progress);
        if (progress >= 1) {
          resolve();
          return;
        }
        const timer = setTimeout(() => {
          this.fadeTimers.delete(timer);
          step();
        }, 10);
        this.fadeTimers.add(timer);
      };
      step();
    });
  }

  private cancelFades(): void {
    this.fadeTimers.forEach((timer) => clearTimeout(timer));
    this.fadeTimers.clear();
  }

  private removePlayer(cueId: string, player: HTMLAudioElement): void {
    player.pause();
    player.currentTime = 0;
    if (this.players.get(cueId) === player) this.players.delete(cueId);
    this.cueVolumes.delete(cueId);
  }

  private fadeInDurationMs(): number {
    return this.settings?.settings().playback.fadeInMs ?? 0;
  }

  private fadeOutDurationMs(): number {
    return this.settings?.settings().playback.fadeOutMs ?? 100;
  }

  private clearNowPlaying(cueId: string): void {
    if (this.nowPlaying()?.cueId === cueId) this.nowPlaying.set(undefined);
  }

  private emit(cueId: string, type: AudioPlaybackEvent['type'], error?: string): void {
    this.playbackSubject.next({ cueId, type, timestamp: Date.now(), error });
  }

  private errorMessage(error: unknown): string {
    if (error instanceof DOMException && error.name) return error.name;
    return error instanceof Error ? error.message : 'Unknown playback error';
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
