import { Component, computed, inject, signal } from '@angular/core';

import { Cue, CueMode } from '../../core/models/cue.model';
import { AudioPlayerService } from '../../core/audio/audio-player.service';
import {
  LiveSessionService,
  DEFAULT_CONFIDENCE_THRESHOLD,
} from '../../core/services/live-session.service';

const SHORTCUTS = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9'] as const;

const MODE_LABEL: Record<CueMode, string> = {
  automatic: 'Automatic',
  confirm: 'Confirm',
  manual: 'Manual',
};

const emptyDraft = (): Cue => ({
  id: crypto.randomUUID(),
  name: '',
  triggers: [],
  audioFile: '',
  mode: 'automatic',
  enabled: true,
  cooldownMs: 3000,
  volume: 1,
  priority: 'normal',
  confidenceThreshold: DEFAULT_CONFIDENCE_THRESHOLD,
  shortcut: undefined,
});

@Component({
  selector: 'app-cues',
  templateUrl: './cues.component.html',
  styleUrl: './cues.component.scss',
})
export class CuesComponent {
  readonly session = inject(LiveSessionService);
  private readonly player = inject(AudioPlayerService);

  readonly shortcuts = SHORTCUTS;
  readonly draft = signal<Cue>(emptyDraft());
  readonly editingId = signal<string | undefined>(undefined);
  readonly triggerInput = signal('');
  readonly testResult = signal<{ cueId: string; ok: boolean; message: string } | undefined>(
    undefined,
  );

  readonly isEditing = computed(() => this.editingId() !== undefined);
  readonly canSave = computed(() => {
    const draft = this.draft();
    return Boolean(draft.name.trim() && draft.triggers.length);
  });
  readonly cooldownSeconds = computed(() => this.draft().cooldownMs / 1000);
  readonly confidencePercent = computed(() =>
    Math.round((this.draft().confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD) * 100),
  );

  modeLabel(mode: CueMode): string {
    return MODE_LABEL[mode];
  }

  cooldownLabel(cue: Cue): string {
    const seconds = cue.cooldownMs / 1000;
    return cue.cooldownMs === 0 ? 'No cooldown' : `${Number(seconds.toFixed(1))} sec`;
  }

  confidenceLabel(cue: Cue): string {
    return `${Math.round((cue.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD) * 100)}%`;
  }

  // ------------------------------------------------------------------ draft

  patchName(name: string): void {
    this.draft.update((cue) => ({ ...cue, name }));
  }

  patchMode(mode: string): void {
    this.draft.update((cue) => ({ ...cue, mode: mode as CueMode }));
  }

  patchCooldownSeconds(value: string): void {
    const seconds = Math.max(0, Number(value) || 0);
    this.draft.update((cue) => ({ ...cue, cooldownMs: Math.round(seconds * 1000) }));
  }

  patchConfidence(value: string): void {
    const percent = Math.min(100, Math.max(0, Number(value) || 0));
    this.draft.update((cue) => ({ ...cue, confidenceThreshold: percent / 100 }));
  }

  patchShortcut(value: string): void {
    this.draft.update((cue) => ({ ...cue, shortcut: value || undefined }));
  }

  updateTriggerInput(value: string): void {
    this.triggerInput.set(value);
  }

  addTrigger(): void {
    const value = this.triggerInput().trim();
    if (!value) return;
    const exists = this.draft().triggers.some(
      (trigger) => trigger.value.toLowerCase() === value.toLowerCase(),
    );
    if (!exists) {
      this.draft.update((cue) => ({
        ...cue,
        triggers: [...cue.triggers, { id: crypto.randomUUID(), value }],
      }));
    }
    this.triggerInput.set('');
  }

  removeTrigger(triggerId: string): void {
    this.draft.update((cue) => ({
      ...cue,
      triggers: cue.triggers.filter((trigger) => trigger.id !== triggerId),
    }));
  }

  selectDraftAudio(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.draft.update((cue) => ({
      ...cue,
      audioFile: URL.createObjectURL(file),
      audioName: file.name,
    }));
  }

  save(): void {
    if (!this.canSave()) return;
    const draft = { ...this.draft(), name: this.draft().name.trim() };
    if (this.editingId()) {
      this.session.updateCue(draft);
    } else {
      this.session.addCue(draft);
    }
    this.resetDraft();
  }

  edit(cue: Cue): void {
    this.editingId.set(cue.id);
    this.draft.set({ ...cue, triggers: cue.triggers.map((trigger) => ({ ...trigger })) });
    this.triggerInput.set('');
  }

  resetDraft(): void {
    this.editingId.set(undefined);
    this.draft.set(emptyDraft());
    this.triggerInput.set('');
  }

  // ----------------------------------------------------------------- actions

  replaceAudio(cue: Cue, event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.session.updateCue({ ...cue, audioFile: URL.createObjectURL(file), audioName: file.name });
  }

  async testCue(cue: Cue): Promise<void> {
    if (!cue.audioFile) {
      this.testResult.set({
        cueId: cue.id,
        ok: false,
        message: 'No audio file assigned. Assign one before testing.',
      });
      return;
    }
    const result = await this.player.play(cue);
    this.testResult.set(
      result === 'played'
        ? { cueId: cue.id, ok: true, message: 'Audio output OK' }
        : {
            cueId: cue.id,
            ok: false,
            message: 'Playback failed. Check the audio output device and the file format.',
          },
    );
  }

  remove(cue: Cue): void {
    this.session.removeCue(cue);
    if (this.editingId() === cue.id) this.resetDraft();
  }
}
