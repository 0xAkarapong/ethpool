import { describe, expect, test } from 'bun:test'
import {
  formatTokenAmount,
  readDecimals,
  readSymbol,
  readTokenMoves,
} from './tokens'

const token = `0x${'ab'.repeat(20)}`
const from = `0x${'11'.repeat(20)}`
const to = `0x${'22'.repeat(20)}`
const transfer =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

function topic(address: string): string {
  return `0x${address.slice(2).padStart(64, '0')}`
}

describe('token moves', () => {
  test('an ERC-20 transfer keeps the raw amount', () => {
    const moves = readTokenMoves([
      {
        address: token,
        topics: [transfer, topic(from), topic(to)],
        data: `0x${(1_500_000).toString(16).padStart(64, '0')}`,
      },
    ])
    expect(moves).toEqual([{ token, from, to, raw: 1_500_000n, tokenId: null }])
    expect(formatTokenAmount(moves[0]?.raw ?? 0n, 6)).toBe('1.5')
  })

  test('a collectible uses its id and a zero fungible amount is skipped', () => {
    const moves = readTokenMoves([
      {
        address: token,
        topics: [
          transfer,
          topic(from),
          topic(to),
          `0x${'a'.padStart(64, '0')}`,
        ],
        data: '0x',
      },
      {
        address: token,
        topics: [transfer, topic(from), topic(to)],
        data: '0x0',
      },
      {
        address: token,
        topics: ['0x1234', topic(from), topic(to)],
        data: '0x01',
      },
    ])
    expect(moves.map((move) => move.tokenId)).toEqual(['10'])
  })

  test('symbol and decimals decode from an eth_call word', () => {
    expect(
      readSymbol(`0x${Buffer.from('USDC').toString('hex').padEnd(64, '0')}`),
    ).toBe('USDC')
    const dynamic = `0x${'0'.repeat(63)}1${(4).toString(16).padStart(64, '0')}${Buffer.from('USDC').toString('hex').padEnd(64, '0')}`
    expect(readSymbol(dynamic)).toBe('USDC')
    expect(readDecimals('0x6')).toBe(6)
    expect(readDecimals('0x63')).toBe(null)
  })

  test('a tiny amount stays visible', () => {
    expect(formatTokenAmount(1n, 18)).toBe('0.000000000000000001')
    expect(formatTokenAmount(1_250_000_000n, 6)).toBe('1,250')
  })
})
