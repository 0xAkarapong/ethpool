import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { offline, overview } from '@/stories/fixtures'
import { Overview } from './overview'

const meta = {
  title: 'Dashboard/Overview',
  component: Overview,
  args: { onRefresh: fn() },
} satisfies Meta<typeof Overview>

export default meta
type Story = StoryObj<typeof meta>

export const Live: Story = {
  args: { result: overview, cached: overview },
}

export const RpcError: Story = {
  args: { result: offline, cached: overview },
}

export const RpcErrorEmpty: Story = {
  args: { result: offline, cached: null },
}
