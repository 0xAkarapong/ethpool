import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { overview } from '@/stories/fixtures'
import { barIndex, Overview } from './overview'

async function markup(data: typeof overview): Promise<string> {
  const root = createRootRoute()
  const index = createRoute({
    getParentRoute: () => root,
    path: '/',
    component: () =>
      createElement(Overview, {
        result: data,
        cached: data,
        onRefresh: () => {},
      }),
  })
  const router = createRouter({
    routeTree: root.addChildren([index]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  return renderToStaticMarkup(createElement(RouterProvider, { router }))
}

describe('pointing at a price bar', () => {
  test('the pointer lands on the bar under it', () => {
    expect(barIndex(0, 400, 40)).toBe(0)
    expect(barIndex(399, 400, 40)).toBe(39)
    expect(barIndex(100, 400, 40)).toBe(10)
  })
})

describe('overview prices', () => {
  test('a quiet chain still separates cheap from dear', async () => {
    const quiet: typeof overview = {
      ...overview,
      baseFeeGwei: 0.046,
      suggested: { low: 0.05, medium: 0.08, high: 0.2 },
      history: [0.04, 0.05, 0.08, 0.2].map((gwei, index) => ({
        gwei,
        time: overview.latest.timestamp - (3 - index) * 12,
      })),
      latest: {
        ...overview.latest,
        gasUsed: 11_400_000,
        gasLimit: 30_000_000,
        txCount: 186,
      },
    }
    const html = await markup(quiet)
    expect(html).toContain('28 Oct 14:32 UTC')
    expect(html).toContain('gwei to get into that batch')
    expect(html).toContain('28 Oct 14:31')
    expect(html).toContain('14:32 UTC')
    expect(html).toContain('Cheapest in this window')
    expect(html).toContain('Dearest in this window')
    expect(html).toContain('How full')
    expect(html).toContain('38%')
    expect(html).not.toContain('Under 17 gwei')
    expect(html).not.toContain('Pending')
    const colors = [...html.matchAll(/background:rgb\(([^)]+)\)/g)].map(
      (match) => match[1],
    )
    expect(new Set(colors).size).toBeGreaterThan(1)
  })
})
