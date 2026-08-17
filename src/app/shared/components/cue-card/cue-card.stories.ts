import type { Meta, StoryObj } from '@storybook/angular';
import { CueCardComponent } from './cue-card.component';
const meta: Meta<CueCardComponent> = { title: 'Shared/CueCard', component: CueCardComponent };
export default meta;
export const Automatic: StoryObj<CueCardComponent> = {
  args: {
    cue: {
      id: 'wife',
      name: 'ESPOSA',
      triggers: [
        { id: 'wife', value: 'esposa' },
        { id: 'my-wife', value: 'mi esposa' },
      ],
      audioFile: 'wife-laugh.mp3',
      mode: 'automatic',
      enabled: true,
      cooldownMs: 3000,
      volume: 1,
      priority: 'normal',
    },
  },
};
