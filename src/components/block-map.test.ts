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
import { blockView, offline } from '@/stories/fixtures'
import { BlockMap, heatGradient, resolvePicked } from './block-map'

async function markup(props: Parameters<typeof BlockMap>[0]): Promise<string> {
  const root = createRootRoute()
  const index = createRoute({
    getParentRoute: () => root,
    path: '/',
    component: () => createElement(BlockMap, props),
  })
  const router = createRouter({
    routeTree: root.addChildren([index]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  return renderToStaticMarkup(createElement(RouterProvider, { router }))
}

describe('heatGradient', () => {
  test('walks from the cheapest fee to the dearest', () => {
    const tone = (gwei: number) => ({ color: gwei < 1 ? 'green' : 'red' })
    const stops = heatGradient(tone, [0.1, 0.2, 5])
    expect(stops[0]).toBe('green')
    expect(stops[stops.length - 1]).toBe('red')
    expect(stops.length).toBe(6)
  })

  test('one price paints one color', () => {
    const tone = () => ({ color: 'green' })
    expect(heatGradient(tone, [0.2, 0.2])).toEqual(['green', 'green'])
  })
})

describe('resolvePicked', () => {
  const cheap = {
    hash: '0xcheap',
    from: '0x1',
    to: '0x2',
    toName: null,
    gas: 21_000,
    feeGwei: 1,
    valueEth: '0.0000',
  }
  const heavy = { ...cheap, hash: '0xheavy', gas: 500_000, feeGwei: 2 }

  test('keeps the stored payment when the block refreshes', () => {
    expect(resolvePicked('0xcheap', [heavy, cheap])?.hash).toBe('0xcheap')
  })

  test('falls back to the largest payment when that one is gone', () => {
    expect(resolvePicked('0xgone', [heavy, cheap])?.hash).toBe('0xheavy')
    expect(resolvePicked(null, [heavy, cheap])?.hash).toBe('0xheavy')
  })
})

describe('block map refresh', () => {
  test('a failed refresh keeps the block and shows the banner', async () => {
    const html = await markup({
      result: offline,
      cached: blockView,
      onRefresh: () => {},
    })
    expect(html).toContain('Block 21,084,331')
    expect(html).toContain('Could not reach Ethereum')
    expect(html).toContain('Open this payment')
    expect(html.match(/href="\/tx\//g)?.length).toBe(2)
  })

  test('a failed first load does not invent a block', async () => {
    const html = await markup({ result: offline, onRefresh: () => {} })
    expect(html).toContain('Could not reach Ethereum')
    expect(html).not.toContain('21,084,331')
  })
})
