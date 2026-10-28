import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  bubbleRadius,
  followPath,
  mapGraph,
  packBubbles,
  TransferSection,
  type TraceStep,
} from './address-view'
import type { Hop } from '@/lib/trace'

describe('address transfer list', () => {
  test('a failed history is a retry, not an empty list', () => {
    const html = renderToStaticMarkup(
      createElement(TransferSection, {
        historyMessage: 'Could not reach Ethereum',
        transfers: [],
        onRetry: () => {},
      }),
    )
    expect(html).toContain('Could not reach Ethereum')
    expect(html).toContain('Retry')
    expect(html).not.toContain('No ETH transfers in the recent window.')
  })

  test('an empty window says there were no transfers', () => {
    const html = renderToStaticMarkup(
      createElement(TransferSection, {
        historyMessage: null,
        transfers: [],
        onRetry: () => {},
      }),
    )
    expect(html).toContain('No ether moved in the recent payments.')
    expect(html).not.toContain('Retry')
  })
})

describe('follow the ether', () => {
  const step = (address: string): TraceStep => ({
    address,
    kind: 'Wallet',
    balance: '1 ETH',
    hops: [],
    historyMessage: null,
    via: null,
  })

  test('a new wallet is the next step', () => {
    const next = followPath(
      [step('0x' + 'a'.repeat(40))],
      step('0x' + 'b'.repeat(40)),
    )
    expect(next).toHaveLength(2)
  })

  test('clicking a wallet already on the board jumps back to it', () => {
    const path = [step('0x' + 'a'.repeat(40)), step('0x' + 'b'.repeat(40))]
    expect(followPath(path, step(path[0].address))).toHaveLength(1)
  })

  test('the board stops at six wallets', () => {
    let path = [step('0x' + 'a'.repeat(40))]
    for (let i = 0; i < 8; i++)
      path = followPath(path, step(`0x${i}${'b'.repeat(39)}`))
    expect(path).toHaveLength(6)
  })

  test('a bigger payment draws a bigger bubble', () => {
    expect(bubbleRadius(2, 2)).toBeGreaterThan(bubbleRadius(2 / 1e6, 2))
  })

  test('one wallet is one bubble, tied to the address you opened', () => {
    const wallet = '0x' + 'b'.repeat(40)
    const opened = step('0x' + 'a'.repeat(40))
    opened.hops = [
      hop(wallet, '0.2'),
      hop(wallet, '0.1', '0x' + 'cd'.repeat(32)),
    ]
    const graph = mapGraph([opened])
    expect(graph.nodes.filter((node) => node.address === wallet)).toHaveLength(
      1,
    )
    expect(graph.links).toEqual([
      { a: opened.address, b: wallet, direction: 'in' },
    ])
  })

  test('packed bubbles do not cover each other', () => {
    const items = [
      { id: 'center', r: 70 },
      ...Array.from({ length: 8 }, (_, index) => ({ id: `n${index}`, r: 28 })),
    ]
    const links = items.slice(1).map((node) => ({ a: 'center', b: node.id }))
    const placed = packBubbles(items, links)
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i]
        const b = placed[j]
        const left = items.find((node) => node.id === a?.id)
        const right = items.find((node) => node.id === b?.id)
        const dist = Math.hypot(
          (a?.x ?? 0) - (b?.x ?? 0),
          (a?.y ?? 0) - (b?.y ?? 0),
        )
        expect(dist).toBeGreaterThanOrEqual(
          (left?.r ?? 0) + (right?.r ?? 0) - 1,
        )
      }
    }
  })
})

function hop(
  counterparty: string,
  amountEth: string,
  hash = '0x' + 'ab'.repeat(32),
): Hop {
  return {
    hash,
    direction: 'in',
    counterparty,
    amountEth,
    addressTo: `/address/${counterparty}`,
    txTo: `/tx/${hash}`,
  }
}
