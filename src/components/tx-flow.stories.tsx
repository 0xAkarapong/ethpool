import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { offline, txFlow } from '@/stories/fixtures'
import { TxFlow } from './tx-flow'

const meta = {
  title: 'Dashboard/Transaction flow',
  component: TxFlow,
  args: { onRefresh: fn() },
} satisfies Meta<typeof TxFlow>

export default meta
type Story = StoryObj<typeof meta>

export const Swap: Story = {
  args: { result: txFlow },
}

export const RpcError: Story = {
  args: { result: offline },
}
