import { describe, expect, test } from 'bun:test'
import {
  classifyQuery,
  normalizeTransfers,
  readTracked,
  trackAddress,
  untrackAddress,
  type KeyValueStore,
} from './trace'

describe('search classification', () => {
  test('a 20-byte address opens the address view', () => {
    const address = `0x${'ab'.repeat(20)}`
    expect(classifyQuery(address.toUpperCase())).toEqual({
      ok: true,
      kind: 'address',
      address,
    })
  })

  test('a 32-byte hash opens transaction flow', () => {
    const hash = `0x${'cd'.repeat(32)}`
    expect(classifyQuery(` ${hash} `)).toEqual({ ok: true, kind: 'tx', hash })
  })

  test('a block number opens the block view', () => {
    expect(classifyQuery('26289590')).toEqual({
      ok: true,
      kind: 'block',
      blockId: '26289590',
    })
  })

  test('an ENS name opens the address view', () => {
    expect(classifyQuery(' Vitalik.ETH ')).toEqual({
      ok: true,
      kind: 'ens',
      name: 'vitalik.eth',
    })
  })

  test('garbage is a structured error', () => {
    expect(() => classifyQuery('not an address')).not.toThrow()
    expect(classifyQuery('not an address')).toEqual({
      ok: false,
      message:
        'Enter an address, an ENS name, a transaction hash, or a block number.',
    })
  })
})

describe('transfer normalization', () => {
  test('keeps dust, including a single wei, as a non-zero amount', () => {
    const subject = `0x${'ab'.repeat(20)}`
    const from = `0x${'ef'.repeat(20)}`
    const hash = `0x${'cd'.repeat(32)}`
    const amounts = [1n, 10n, 9_999_999_999n, 1_000_000_000_000n]
    const hops = normalizeTransfers(
      subject,
      amounts.map((valueWei, index) => ({
        hash,
        from,
        to: subject,
        valueWei,
        time: index,
      })),
    )
    expect(hops).toHaveLength(amounts.length)
    const newestFirst = [...amounts].reverse()
    for (const [index, wei] of newestFirst.entries()) {
      expect(hops[index].amountEth).not.toBe('0.')
      expect(hops[index].amountEth).not.toBe('0.0000')
      expect(weiFromEth(hops[index].amountEth)).toBe(wei)
    }
  })
})

function weiFromEth(text: string): bigint {
  const [whole, fraction = ''] = text.split('.')
  if (!/^\d+$/.test(whole) || !/^\d+$/.test(fraction)) {
    throw new Error(`not an eth amount: ${text}`)
  }
  return BigInt(whole) * 10n ** 18n + BigInt(fraction.padEnd(18, '0'))
}

describe('tracked addresses', () => {
  test('survives a reload and drops when removed', () => {
    const memory = new Map<string, string>()
    const open = (): KeyValueStore => ({
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => {
        memory.set(key, value)
      },
    })
    const address = `0x${'11'.repeat(20)}`
    expect(trackAddress(open(), address.toUpperCase())).toEqual([address])
    expect(readTracked(open())).toEqual([address])
    expect(untrackAddress(open(), address)).toEqual([])
    expect(readTracked(open())).toEqual([])
  })
})
