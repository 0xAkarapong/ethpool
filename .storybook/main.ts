import type { StorybookConfig } from '@storybook/react-vite'

const config = {
  stories: ['../src/**/*.stories.tsx'],
  framework: '@storybook/react-vite',
  core: {
    builder: {
      name: '@storybook/builder-vite',
      options: {
        viteConfigPath: '.storybook/vite.config.ts',
      },
    },
  },
} satisfies StorybookConfig

export default config
