import type { Meta, StoryObj } from '@storybook/angular';
import { StatusIndicatorComponent } from './status-indicator.component';
const meta: Meta<StatusIndicatorComponent> = {
  title: 'Shared/StatusIndicator',
  component: StatusIndicatorComponent,
};
export default meta;
export const Ready: StoryObj<StatusIndicatorComponent> = {
  args: { label: 'READY', active: false },
};
export const Listening: StoryObj<StatusIndicatorComponent> = {
  args: { label: 'LISTENING', active: true },
};
