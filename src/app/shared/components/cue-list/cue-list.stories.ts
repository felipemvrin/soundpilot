import type { Meta, StoryObj } from '@storybook/angular';
import { CueListComponent } from './cue-list.component';
const meta: Meta<CueListComponent> = { title: 'Shared/CueList', component: CueListComponent };
export default meta;
export const TwoCues: StoryObj<CueListComponent> = {
  args: {
    cues: [
      {
        id: 'wife',
        name: 'ESPOSA',
        triggers: [{ id: 'wife', value: 'esposa' }],
        audioFile: '',
        mode: 'automatic',
        enabled: true,
        cooldownMs: 3000,
        volume: 1,
        priority: 'normal',
      },
      {
        id: 'boss',
        name: 'JEFE',
        triggers: [{ id: 'boss', value: 'jefe' }],
        audioFile: '',
        mode: 'manual',
        enabled: true,
        cooldownMs: 1000,
        volume: 0.8,
        priority: 'normal',
      },
    ],
  },
};
