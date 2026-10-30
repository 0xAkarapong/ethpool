import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { SupplyData } from '@/lib/supply'
import { SupplyPanel } from './supply-view'

const day = Date.UTC(2026, 9, 30) / 1000

const points = [
  { t: day - 86_400 * 2, supply: 120_400_000 },
  { t: day - 86_400, supply: 120_200_000 },
  { t: day, supply: 122_170_000 },
]

const data: SupplyData = {
  ok: true,
  host: 'ultrasound.money',
  updatedAt: day * 1000,
  asOf: day - 40,
  supply: 122_170_000,
  mergeSupply: 120_500_000,
  issuedEthPerYear: 1_091_000,
  points,
  series: {
    m5: points,
    h1: points,
    d1: points,
    d7: points,
    d30: points,
    since_merge: points,
  },
  rates: {
    m5: { growth: 0.011, burnEthPerYear: 1, issuedEthPerYear: 1 },
    h1: { growth: 0.008, burnEthPerYear: 1, issuedEthPerYear: 1 },
    d1: { growth: 0.008, burnEthPerYear: 1, issuedEthPerYear: 1 },
    d7: { growth: 0.008, burnEthPerYear: 1, issuedEthPerYear: 1 },
    d30: { growth: 0.008, burnEthPerYear: 1, issuedEthPerYear: 1 },
    since_merge: {
      growth: 0.00332,
      burnEthPerYear: 660_000,
      issuedEthPerYear: 1_091_000,
    },
  },
}

describe('supply panel', () => {
  test('shows the merge clock, the latest total, and the pace since mining stopped', () => {
    const html = renderToStaticMarkup(createElement(SupplyPanel, { data }))
    expect(html).toContain('ETH in existence')
    expect(html).toContain('4y 45d')
    expect(html).toContain('+0.332%/y')
    expect(html).toContain('122,170,000 ETH')
    expect(html).toContain('growing at 0.332% a year')
    expect(html).toContain('since mining stopped')
    expect(html).toContain('660,000 ETH is destroyed')
    expect(html).toContain('Updated 40 seconds ago')
    expect(html).toContain('bg-card')
    expect(html).not.toContain('#172038')
    expect(html).toContain('aria-pressed="true"')
  })
})
