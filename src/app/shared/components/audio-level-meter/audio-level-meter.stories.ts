import type { Meta, StoryObj } from '@storybook/angular';
import { AudioLevelMeterComponent } from './audio-level-meter.component';
const meta: Meta<AudioLevelMeterComponent> = {
  title: 'Shared/AudioLevelMeter',
  component: AudioLevelMeterComponent,
};
export default meta;
export const Active: StoryObj<AudioLevelMeterComponent> = { args: { level: 0.72 } };
