import { describe, expect, test } from 'bun:test'
import { splitRibbons } from './tx-flow'

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
