import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  followPath,
  ribbonHeights,
  walletRibbons,
  type TraceStep,
} from './address-graph'
import { TransferSection } from './address-view'
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

  test('a bigger payment draws a thicker bar', () => {
    const [large, small] = ribbonHeights([2, 2 / 1e6])
    expect(large).toBeGreaterThan(small ?? 0)
  })

  test('repeated payments to one wallet are one bar', () => {
    const wallet = '0x' + 'b'.repeat(40)
    const columns = walletRibbons([
      hop(wallet, '0.2'),
      hop(wallet, '0.1', '0x' + 'cd'.repeat(32)),
      hop(wallet, '0.05', '0x' + 'ef'.repeat(32), 'out'),
    ])
    expect(columns.incoming).toHaveLength(1)
    expect(columns.incoming[0]?.hash).toBe('0x' + 'ab'.repeat(32))
    expect(columns.incoming[0]?.label).toBe('0.3')
    expect(columns.outgoing).toEqual([
      expect.objectContaining({ address: wallet, direction: 'out' }),
    ])
  })

  test('the board shows the amount and which way the ether moved', () => {
    const wallet = '0x' + 'b'.repeat(40)
    const html = renderToStaticMarkup(
      createElement(TransferSection, {
        address: '0x' + 'a'.repeat(40),
        historyMessage: null,
        transfers: [hop(wallet, '1.2'), hop(wallet, '0.4', undefined, 'out')],
        onRetry: () => {},
        balance: '2 ETH',
      }),
    )
    expect(html).toContain('Money in')
    expect(html).toContain('Money out')
    expect(html).toContain('1.2 ETH')
    expect(html).toContain('0.4 ETH')
    expect(html).toContain('2 ETH')
    expect(html).not.toContain('bubble')
  })
})

function hop(
  counterparty: string,
  amountEth: string,
  hash = '0x' + 'ab'.repeat(32),
  direction: Hop['direction'] = 'in',
): Hop {
  return {
    hash,
    direction,
    counterparty,
    amountEth,
    addressTo: `/address/${counterparty}`,
    txTo: `/tx/${hash}`,
  }
}
