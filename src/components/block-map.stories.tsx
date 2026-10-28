import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { blockView, offline } from '@/stories/fixtures'
import { BlockMap } from './block-map'

const meta = {
  title: 'Dashboard/Block map',
  component: BlockMap,
  args: { onRefresh: fn() },
} satisfies Meta<typeof BlockMap>

export default meta
type Story = StoryObj<typeof meta>

export const Transactions: Story = {
  args: { result: blockView },
}

export const RpcError: Story = {
  args: { result: offline },
}
