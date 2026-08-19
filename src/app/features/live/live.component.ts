import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Cue } from '../../core/models/cue.model';
import { PendingConfirmation, PreflightReport } from '../../core/models/session.model';
import { AudioPlayerService } from '../../core/audio/audio-player.service';
import { LiveSessionService } from '../../core/services/live-session.service';
import { PreflightService } from '../../core/services/preflight.service';
import { TranscriptHighlighterService } from '../../core/services/transcript-highlighter.service';
import { ConfidenceBadgeComponent } from '../../shared/components/confidence-badge/confidence-badge.component';
import { CueStatusChipComponent } from '../../shared/components/cue-status-chip/cue-status-chip.component';
import { EventLogComponent } from '../../shared/components/event-log/event-log.component';

const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'OPTION']);

@Component({
  selector: 'app-live',
  imports: [
    DatePipe,
    RouterLink,
    ConfidenceBadgeComponent,
    CueStatusChipComponent,
    EventLogComponent,
  ],
  templateUrl: './live.component.html',
  styleUrl: './live.component.scss',
  host: { '(document:keydown)': 'onKeydown($event)' },
})
export class LiveComponent {
  readonly session = inject(LiveSessionService);
  private readonly preflight = inject(PreflightService);
  private readonly player = inject(AudioPlayerService);
  private readonly highlighter = inject(TranscriptHighlighterService);

  readonly report = signal<PreflightReport | undefined>(undefined);
  readonly preflightRunning = signal(false);
  readonly outputTestRunning = signal(false);
  private readonly checkedCueState = signal<string | undefined>(undefined);
  readonly preflightOutdated = computed(
    () => this.report() !== undefined && this.checkedCueState() !== this.cueState(),
  );

  readonly transcriptSegments = computed(() => {
    const transcript = this.session.transcript();
    if (!transcript?.text) return [];
    const detection = this.session.detection();
    const sameUtterance = detection?.event.transcript.text === transcript.text;
    return this.highlighter.highlight(
      transcript.text,
      sameUtterance ? detection?.event.trigger.value : undefined,
    );
  });

  readonly elapsedLabel = computed(() => {
    const totalSeconds = Math.floor(this.session.playbackElapsedMs() / 1000);
    const minutes = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  });

  async runPreflight(): Promise<void> {
    this.preflightRunning.set(true);
    try {
      this.report.set(await this.preflight.run(this.session.cues()));
      this.checkedCueState.set(this.cueState());
    } finally {
      this.preflightRunning.set(false);
    }
  }

  dismissPreflight(): void {
    this.report.set(undefined);
  }

  async testAudioOutput(): Promise<void> {
    const cue = this.session.enabledCues().find((item) => Boolean(item.audioFile));
    if (!cue || this.outputTestRunning()) return;
    this.outputTestRunning.set(true);
    const playback = await this.player.play(cue);
    this.outputTestRunning.set(false);
    this.report.update((report) => {
      if (!report) return report;
      const checks = report.checks.map((check) =>
        check.id !== 'output'
          ? check
          : playback === 'played'
            ? {
                ...check,
                status: 'pass' as const,
                severity: 'info' as const,
                message: 'Test playback started successfully.',
                details: [`Playing ${cue.name}. Confirm it is audible on the assigned output.`],
                actionId: undefined,
              }
            : {
                ...check,
                status: 'fail' as const,
                severity: 'error' as const,
                message: 'Test playback failed.',
                details: [
                  'Check the output device, browser audio permissions and cue file format.',
                ],
                actionId: undefined,
              },
      );
      return { ...report, checks, status: this.preflight.statusFor(checks) };
    });
  }

  playCue(cue: Cue): void {
    void this.session.playCue(cue);
  }

  confirm(pending: PendingConfirmation): void {
    void this.session.confirmPending(pending);
  }

  onKeydown(event: KeyboardEvent): void {
    if (this.isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;

    if (this.handleCueKey(event.key)) {
      event.preventDefault();
      return;
    }

    switch (event.key) {
      case ' ':
      case 'Enter':
        if (this.session.hasPendingConfirmations()) {
          event.preventDefault();
          void this.session.confirmFirstPending();
        }
        return;
      case 'Escape':
        if (this.session.hasPendingConfirmations()) {
          event.preventDefault();
          this.session.ignoreFirstPending();
        }
        return;
      case 'p':
      case 'P':
        event.preventDefault();
        void this.session.toggleListening();
        return;
      case 'm':
      case 'M':
        event.preventDefault();
        this.session.toggleMute();
        return;
      case 'r':
      case 'R':
        event.preventDefault();
        void this.session.replayLast();
        return;
      case 's':
      case 'S':
        event.preventDefault();
        this.session.stopPlayback();
        return;
      default:
        return;
    }
  }

  private handleCueKey(key: string): boolean {
    const match = /^F([1-9])$/.exec(key) ?? /^([1-9])$/.exec(key);
    if (!match) return false;
    const position = Number(match[1]);
    const cues = this.session.enabledCues();
    const cue = cues.find((item) => item.shortcut === `F${position}`) ?? cues[position - 1];
    if (cue) void this.session.playCue(cue);
    return true;
  }

  private isTyping(target: EventTarget | null): boolean {
    const element = target as HTMLElement | null;
    if (!element) return false;
    return EDITABLE_TAGS.has(element.tagName) || element.isContentEditable;
  }

  private cueState(): string {
    return JSON.stringify(this.session.cues());
  }
}
