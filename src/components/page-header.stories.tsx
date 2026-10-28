import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { PageHeader } from './shell'

const updatedAt = Date.parse('2026-10-28T14:32:18Z')

const meta = {
  title: 'Dashboard/Page header',
  component: PageHeader,
  args: {
    title: 'Overview',
    subtitle: 'Mempool and base fee on Ethereum mainnet',
    updatedAt,
    onRefresh: fn(),
  },
} satisfies Meta<typeof PageHeader>

export default meta
type Story = StoryObj<typeof meta>

export const Live: Story = {
  args: { live: true },
}

export const Offline: Story = {
  args: { live: false },
}
