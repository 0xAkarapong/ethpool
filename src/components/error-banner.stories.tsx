import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { ErrorBanner } from './shell'

const meta = {
  title: 'Dashboard/Error banner',
  component: ErrorBanner,
  args: { onRetry: fn() },
} satisfies Meta<typeof ErrorBanner>

export default meta
type Story = StoryObj<typeof meta>

export const Offline: Story = {
  args: { message: 'Could not reach Ethereum' },
}

export const Invalid: Story = {
  args: { message: 'Invalid transaction' },
}
