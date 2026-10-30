import { describe, expect, test } from 'bun:test'
import {
  bitcoinIssued,
  bitcoinScaled,
  chartFrame,
  deltasFrom,
  formatSupplyDelta,
  formatYearlyRate,
  MERGE_SEC,
  paceSentence,
  pointIndex,
  proofOfWorkSupply,
  sinceMergeLabel,
  SUPPLY_PLOT,
  supplyAge,
} from './supply'

describe('supply since the merge', () => {
  test('30 Oct 2026 is 4 years and 45 days after 15 Sep 2022', () => {
    expect(sinceMergeLabel(Date.UTC(2026, 9, 30))).toBe('4y 45d')
    expect(sinceMergeLabel(Date.UTC(2022, 8, 15))).toBe('0y 0d')
    expect(sinceMergeLabel(Date.UTC(2022, 8, 14))).toBe('0y 0d')
    expect(
      supplyAge(Date.UTC(2026, 9, 30), Date.UTC(2026, 9, 30) / 1000 - 40),
    ).toBe('40 seconds ago')
    expect(
      supplyAge(Date.UTC(2026, 9, 30), Date.UTC(2026, 9, 30) / 1000 - 60),
    ).toBe('1 minute ago')
  })

  test('a yearly pace reads as growth or burn', () => {
    expect(formatYearlyRate(0.00332)).toBe('+0.332%/y')
    expect(formatYearlyRate(-0.001)).toBe('−0.100%/y')
    expect(formatYearlyRate(0)).toBe('0.000%/y')
    expect(formatSupplyDelta(-1500.2)).toBe('−1,500 ETH')
    expect(formatSupplyDelta(1.35)).toBe('+1.4 ETH')
    expect(formatSupplyDelta(0.01)).toBe('0 ETH')
    expect(
      paceSentence('d1', {
        growth: 0.00332,
        burnEthPerYear: 660_000,
        issuedEthPerYear: 1_091_000,
      }),
    ).toContain('growing at 0.332% a year')
    expect(
      paceSentence('since_merge', {
        growth: -0.00063,
        burnEthPerYear: 10,
        issuedEthPerYear: 10,
      }),
    ).toContain('shrinking at 0.063% a year')
  })

  test('bitcoin issuance halves across April 2024 and scales onto ether', () => {
    const halving = 50_347_588
    expect(bitcoinIssued(halving - 600, 600)).toBeCloseTo(6.25, 8)
    expect(bitcoinIssued(halving + 1, 600)).toBeCloseTo(3.125, 8)
    expect(bitcoinIssued(halving - 300, 600)).toBeCloseTo(
      300 * (6.25 / 600) + 300 * (3.125 / 600),
      8,
    )
    const points = [
      { t: MERGE_SEC, supply: 120_000_000 },
      { t: MERGE_SEC + 600, supply: 120_000_000 },
    ]
    const scaled = bitcoinScaled(points)
    expect(scaled[0]).toBeCloseTo(120_000_000, 3)
    expect(scaled[1] - scaled[0]).toBeCloseTo(
      6.25 * (120_000_000 / 19_152_350),
      3,
    )
  })

  test('the mining line starts at the merge supply and adds the mining gap', () => {
    const points = [
      { t: MERGE_SEC, supply: 100 },
      { t: MERGE_SEC + 86_400, supply: 101 },
    ]
    const series = proofOfWorkSupply(points, 365.25)
    expect(series[0]).toBe(100)
    expect(series[1]).toBeCloseTo(101 + 13_500 - 1, 6)
  })

  test('the zero line sits between a burn dip and later growth', () => {
    const frame = chartFrame([deltasFrom(100, [90, 100, 130])], SUPPLY_PLOT)
    const yDip = frame.yAt(-10)
    const yZero = frame.yAt(0)
    const yGrowth = frame.yAt(30)
    expect(yDip).toBeGreaterThan(yZero)
    expect(yZero).toBeGreaterThan(yGrowth)
    expect(pointIndex(SUPPLY_PLOT.left, SUPPLY_PLOT, 3)).toBe(0)
    expect(
      pointIndex(SUPPLY_PLOT.left + SUPPLY_PLOT.width, SUPPLY_PLOT, 3),
    ).toBe(2)
  })
})
