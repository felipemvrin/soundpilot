import { Component, computed, inject, signal } from '@angular/core';

import { Cue, CueMode } from '../../core/models/cue.model';
import { AudioPlayerService } from '../../core/audio/audio-player.service';
import {
  CueValidationErrors,
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
  readonly editorOpen = signal(false);
  readonly triggerInput = signal('');
  readonly errors = signal<CueValidationErrors>({});
  readonly deleteCandidate = signal<Cue | undefined>(undefined);
  readonly testingCueId = signal<string | undefined>(undefined);
  readonly testResult = signal<{ cueId: string; ok: boolean; message: string } | undefined>(
    undefined,
  );

  readonly isEditing = computed(() => this.editingId() !== undefined);
  readonly canSave = computed(() => {
    const draft = this.draft();
    return Boolean(draft.name.trim());
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
    this.clearError('name');
  }

  patchMode(mode: string): void {
    this.draft.update((cue) => ({ ...cue, mode: mode as CueMode }));
  }

  patchCooldownSeconds(value: string): void {
    const seconds = Math.max(0, Number(value) || 0);
    this.draft.update((cue) => ({ ...cue, cooldownMs: Math.round(seconds * 1000) }));
    this.clearError('cooldown');
  }

  patchConfidence(value: string): void {
    const percent = Math.min(100, Math.max(0, Number(value) || 0));
    this.draft.update((cue) => ({ ...cue, confidenceThreshold: percent / 100 }));
    this.clearError('confidence');
  }

  patchShortcut(value: string): void {
    this.draft.update((cue) => ({ ...cue, shortcut: value || undefined }));
    this.clearError('shortcut');
  }

  patchEnabled(enabled: boolean): void {
    this.draft.update((cue) => ({ ...cue, enabled }));
  }

  updateTriggerInput(value: string): void {
    this.triggerInput.set(value);
  }

  addTrigger(): void {
    const value = this.triggerInput().trim();
    if (!value) {
      this.errors.update((errors) => ({ ...errors, triggers: 'Triggers cannot be empty.' }));
      return;
    }
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
    this.clearError('triggers');
  }

  removeTrigger(triggerId: string): void {
    this.draft.update((cue) => ({
      ...cue,
      triggers: cue.triggers.filter((trigger) => trigger.id !== triggerId),
    }));
    this.clearError('triggers');
  }

  editTrigger(trigger: Cue['triggers'][number]): void {
    this.triggerInput.set(trigger.value);
    this.removeTrigger(trigger.id);
  }

  async selectDraftAudio(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.draft.update((cue) => ({
      ...cue,
      audioFile: '',
      audioName: file.name,
    }));
    try {
      const audioFile = await this.fileAsDataUrl(file);
      this.draft.update((cue) => ({ ...cue, audioFile }));
      this.clearError('audio');
    } catch {
      this.errors.update((errors) => ({
        ...errors,
        audio: 'Could not read the selected audio file.',
      }));
    }
  }

  save(): void {
    if (!this.canSave()) return;
    const draft = { ...this.draft(), name: this.draft().name.trim() };
    const errors = this.session.saveCue(draft);
    this.errors.set(errors);
    if (Object.keys(errors).length) return;
    this.resetDraft();
  }

  edit(cue: Cue): void {
    this.editingId.set(cue.id);
    this.editorOpen.set(true);
    this.draft.set({ ...cue, triggers: cue.triggers.map((trigger) => ({ ...trigger })) });
    this.triggerInput.set('');
    this.errors.set({});
  }

  startCreate(): void {
    this.resetDraft();
    this.editorOpen.set(true);
  }

  resetDraft(): void {
    this.editingId.set(undefined);
    this.draft.set(emptyDraft());
    this.triggerInput.set('');
    this.errors.set({});
    this.editorOpen.set(false);
  }

  // ----------------------------------------------------------------- actions

  async replaceAudio(cue: Cue, event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const audioFile = await this.fileAsDataUrl(file);
      this.session.updateCue({ ...cue, audioFile, audioName: file.name });
      this.testResult.set({ cueId: cue.id, ok: true, message: 'Audio updated' });
    } catch {
      this.testResult.set({
        cueId: cue.id,
        ok: false,
        message: 'Could not read the selected audio file.',
      });
    }
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
    if (this.testingCueId() === cue.id) {
      this.player.stop(cue.id);
      this.testingCueId.set(undefined);
      return;
    }
    if (this.testingCueId()) return;
    this.testingCueId.set(cue.id);
    this.testResult.set({ cueId: cue.id, ok: true, message: 'Testing audio...' });
    const result = await this.player.play(cue);
    this.testingCueId.set(undefined);
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
    this.deleteCandidate.set(cue);
  }

  confirmDelete(): void {
    const cue = this.deleteCandidate();
    if (!cue) return;
    this.session.removeCue(cue);
    if (this.editingId() === cue.id) this.resetDraft();
    this.deleteCandidate.set(undefined);
  }

  private clearError(field: keyof CueValidationErrors): void {
    this.errors.update((errors) => ({ ...errors, [field]: undefined }));
  }

  private fileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
}
