import type { Preview } from '@storybook/react-vite'
import { WithRouter } from './router'
import '../src/styles.css'

const preview = {
  parameters: {
    layout: 'fullscreen',
  },
  initialGlobals: {
    theme: 'light',
  },
  globalTypes: {
    theme: {
      description: 'Color theme',
      toolbar: {
        title: 'Theme',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      document.documentElement.classList.toggle(
        'dark',
        context.globals.theme === 'dark',
      )
      return (
        <WithRouter storyId={context.id}>
          <div className="min-h-screen bg-muted">
            <Story />
          </div>
        </WithRouter>
      )
    },
  ],
} satisfies Preview

export default preview
