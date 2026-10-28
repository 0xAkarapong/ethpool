import { describe, expect, test } from 'bun:test'
import {
  axisMax,
  feeHeat,
  feeLevel,
  formatAge,
  formatEth,
  formatGwei,
  shortAddress,
  usageLevel,
} from './format'

describe('fee bands', () => {
  test('splits price and block fullness on the design thresholds', () => {
    expect(feeLevel(16.99)).toBe('low')
    expect(feeLevel(17)).toBe('medium')
    expect(feeLevel(21.99)).toBe('medium')
    expect(feeLevel(22)).toBe('high')
    expect(usageLevel(59)).toBe('calm')
    expect(usageLevel(60)).toBe('steady')
    expect(usageLevel(81)).toBe('steady')
    expect(usageLevel(82)).toBe('busy')
  })
})

describe('formatters', () => {
  test('keeps eth on integers so a whole ether does not round', () => {
    expect(formatEth(1_240_000_000_000_000_000n)).toBe('1.2400')
    expect(formatEth(7_847_772_000_000_000n)).toBe('0.0078')
    expect(formatGwei(18.42)).toBe('18.42')
    expect(shortAddress('0x91c4a8E2b17c09d4F0aA21e8c3b77E2a1d04c91c')).toBe(
      '0x91c4a8E2…04c91c',
    )
    expect(formatAge(1_700_000_012_000, 1_700_000_000)).toBe('12 seconds ago')
    expect(formatAge(1_700_000_120_000, 1_700_000_000)).toBe('2m ago')
  })

  test('picks a chart ceiling above the peak', () => {
    expect(axisMax([18.42, 27.15])).toBe(40)
  })
})

describe('block heat', () => {
  test('separates a cheap fee from a dear one in the same block', () => {
    const tone = feeHeat([0.07, 0.08, 0.12, 0.2, 2.1])
    expect(tone(0.07).color).not.toBe(tone(2.1).color)
  })

  test('stays one color when the block barely moves', () => {
    const tone = feeHeat([0.07, 0.071, 0.072])
    expect(tone(0.07).color).toBe(tone(0.072).color)
  })
})
