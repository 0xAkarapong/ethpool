import type { Meta, StoryObj } from '@storybook/react-vite'
import { AppShell } from './shell'

const meta = {
  title: 'Dashboard/Shell',
  component: AppShell,
} satisfies Meta<typeof AppShell>

export default meta
type Story = StoryObj<typeof meta>

export const Sidebar: Story = {
  args: {
    children: (
      <p className="text-sm text-muted-foreground">Page content sits here.</p>
    ),
  },
}
