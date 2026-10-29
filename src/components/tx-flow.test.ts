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
import { txFlow } from '@/stories/fixtures'
import { splitRibbons, TxFlow } from './tx-flow'

async function markup(result: typeof txFlow): Promise<string> {
  const root = createRootRoute()
  const index = createRoute({
    getParentRoute: () => root,
    path: '/',
    component: () => createElement(TxFlow, { result, onRefresh: () => {} }),
  })
  const router = createRouter({
    routeTree: root.addChildren([index]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  return renderToStaticMarkup(createElement(RouterProvider, { router }))
}

describe('a program call', () => {
  test('shows what ran when no ether moved', async () => {
    const html = await markup({
      ...txFlow,
      valueEth: '0.0000',
      burnedEth: '0.0000',
      tipEth: '0.0000',
      totalEth: '0.0000',
      tokens: [],
      call: {
        kind: 'call',
        name: 'run a program',
        selector: '0xdeadbeef',
        known: false,
      },
      succeeded: true,
    })
    expect(html).toContain('This ran.')
    expect(html).toContain('to run a program.')
    expect(html).toContain('0xdeadbeef')
    expect(html).not.toContain('No ether moved.')
  })

  test('says when the program refused', async () => {
    const html = await markup({
      ...txFlow,
      succeeded: false,
    })
    expect(html).toContain('This did not go through.')
    expect(html).toContain('to run a swap.')
  })
})

describe('transaction split', () => {
  test('a zero part is left off the picture', () => {
    const ribbons = splitRibbons([
      { key: 'value', amount: 0 },
      { key: 'burn', amount: 0.002 },
      { key: 'tip', amount: 0.001 },
    ])
    expect(ribbons.map((ribbon) => ribbon.key)).toEqual(['burn', 'tip'])
  })

  test('more ether draws a thicker ribbon and the stack fits the track', () => {
    const ribbons = splitRibbons(
      [
        { key: 'value', amount: 1.24 },
        { key: 'burn', amount: 0.0034 },
        { key: 'tip', amount: 0.0044 },
      ],
      36,
      168,
    )
    const value = ribbons[0]
    const burn = ribbons[1]
    expect(value?.h).toBeGreaterThan(burn?.h ?? 0)
    expect(burn?.h).toBeGreaterThan(4)
    const last = ribbons[ribbons.length - 1]
    expect((last?.y ?? 0) + (last?.h ?? 0)).toBeLessThanOrEqual(36 + 168)
  })
})
