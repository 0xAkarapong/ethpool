import { formatNumber } from './format'

export const SUPPLY_WINDOWS = [
  'm5',
  'h1',
  'd1',
  'd7',
  'd30',
  'since_merge',
] as const

export type SupplyWindow = (typeof SUPPLY_WINDOWS)[number]

export type SupplyRate = {
  growth: number
  burnEthPerYear: number
  issuedEthPerYear: number
}

export type SupplyPoint = { t: number; supply: number }

export type SupplyData = {
  ok: true
  host: string
  updatedAt: number
  asOf: number
  supply: number
  mergeSupply: number
  issuedEthPerYear: number
  /** Since-merge history. Comparisons use this, not the short windows. */
  points: Array<SupplyPoint>
  /** One series per measure window. Short windows are denser than `points`. */
  series: Record<SupplyWindow, Array<SupplyPoint>>
  rates: Record<SupplyWindow, SupplyRate>
}

export type SupplyResult =
  SupplyData | { ok: false; host: string; updatedAt: number; message: string }

export const WINDOW_LABEL: Record<SupplyWindow, string> = {
  m5: '5 min',
  h1: '1 hour',
  d1: '1 day',
  d7: '7 days',
  d30: '30 days',
  since_merge: 'Since merge',
}

const WINDOW_SPAN: Record<SupplyWindow, string> = {
  m5: 'the last 5 minutes',
  h1: 'the last hour',
  d1: 'the last day',
  d7: 'the last 7 days',
  d30: 'the last 30 days',
  since_merge: 'the time since mining stopped',
}

/** Paris merge, 2022-09-15T06:42:59Z. Bitcoin's clock is measured from here. */
export const MERGE_SEC = 1_663_224_179

const BTC_SUPPLY_AT_MERGE = 19_152_350
const BTC_PER_SECOND = 6.25 / 600
const BTC_PER_SECOND_AFTER = BTC_PER_SECOND / 2
/** Seconds after the merge until the 2024-04-20 Bitcoin halving. */
// shortcut: only the 2024 halving is modeled, add the 2028 cut when that date is inside the chart
const BTC_HALVING_AFTER_MERGE = 50_347_588

const POW_ETH_PER_DAY = 13_500
const SECONDS_PER_DAY = 86_400
const YEAR_DAYS = 365.25

export type Plot = { left: number; top: number; width: number; height: number }

export const SUPPLY_PLOT: Plot = { left: 36, top: 18, width: 540, height: 220 }

export function sinceMergeLabel(nowMs: number): string {
  const now = new Date(nowMs)
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth()
  const day = now.getUTCDate()
  let years = year - 2022
  const beforeAnniversary = month < 8 || (month === 8 && day < 15)
  if (beforeAnniversary) years -= 1
  if (years < 0) return '0y 0d'
  const start = Date.UTC(beforeAnniversary ? year - 1 : year, 8, 15)
  const today = Date.UTC(year, month, day)
  const days = Math.round((today - start) / 86_400_000)
  return `${years}y ${days}d`
}

export function supplyAge(nowMs: number, asOfSec: number): string {
  const seconds = Math.max(0, Math.round(nowMs / 1000 - asOfSec))
  if (seconds < 60) return `${seconds} seconds ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60)
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  const days = Math.floor(hours / 24)
  return `${days} ${days === 1 ? 'day' : 'days'} ago`
}

export function formatYearlyRate(fraction: number): string {
  const percent = Math.abs(fraction * 100).toFixed(3)
  if (fraction > 0) return `+${percent}%/y`
  if (fraction < 0) return `−${percent}%/y`
  return '0.000%/y'
}

export function formatSupplyCount(value: number): string {
  return `${Math.round(value).toLocaleString('en-US')} ETH`
}

export function formatSupplyDelta(value: number): string {
  const abs = Math.abs(value)
  if (abs < 0.05) return '0 ETH'
  const body =
    abs >= 10
      ? Math.round(abs).toLocaleString('en-US')
      : abs.toLocaleString('en-US', {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })
  if (value > 0) return `+${body} ETH`
  return `−${body} ETH`
}

export function paceSentence(window: SupplyWindow, rate: SupplyRate): string {
  const burned = formatNumber(Math.round(rate.burnEthPerYear))
  const issued = formatNumber(Math.round(rate.issuedEthPerYear))
  const tail = `About ${issued} ETH is created a year, and about ${burned} ETH is destroyed.`
  const percent = Math.abs(rate.growth * 100).toFixed(3)
  if (rate.growth > 0)
    return `Measured over ${WINDOW_SPAN[window]}, supply is growing at ${percent}% a year. ${tail}`
  if (rate.growth < 0)
    return `Measured over ${WINDOW_SPAN[window]}, supply is shrinking at ${percent}% a year. ${tail}`
  return `Measured over ${WINDOW_SPAN[window]}, supply is holding still. ${tail}`
}

/** Bitcoin minted between startFromMerge and that instant plus seconds. */
export function bitcoinIssued(startFromMerge: number, seconds: number): number {
  const end = startFromMerge + seconds
  if (end < BTC_HALVING_AFTER_MERGE) return seconds * BTC_PER_SECOND
  if (startFromMerge > BTC_HALVING_AFTER_MERGE)
    return seconds * BTC_PER_SECOND_AFTER
  return (
    (BTC_HALVING_AFTER_MERGE - startFromMerge) * BTC_PER_SECOND +
    (end - BTC_HALVING_AFTER_MERGE) * BTC_PER_SECOND_AFTER
  )
}

/** Ether totals if supply had grown at Bitcoin's issuance, pinned to the first point. */
export function bitcoinScaled(points: Array<SupplyPoint>): Array<number> {
  if (points.length === 0) return []
  const firstFromMerge = points[0].t - MERGE_SEC
  const firstBtc = BTC_SUPPLY_AT_MERGE + bitcoinIssued(0, firstFromMerge)
  const scale = points[0].supply / firstBtc
  return points.map((point) => {
    const issued = bitcoinIssued(firstFromMerge, point.t - points[0].t)
    return (firstBtc + issued) * scale
  })
}

/**
 * Ether totals if proof-of-work mining had continued instead of staking.
 * issuedEthPerYear is today's staking issuance, subtracted so the line is mining only.
 */
export function proofOfWorkSupply(
  points: Array<SupplyPoint>,
  issuedEthPerYear: number,
): Array<number> {
  if (points.length === 0) return []
  const extraPerDay = POW_ETH_PER_DAY - issuedEthPerYear / YEAR_DAYS
  const start = points[0].t
  return points.map(
    (point) =>
      point.supply + ((point.t - start) / SECONDS_PER_DAY) * extraPerDay,
  )
}

export function deltasFrom(base: number, values: Array<number>): Array<number> {
  return values.map((value) => value - base)
}

export function chartFrame(rows: Array<Array<number>>, plot: Plot) {
  let lo = 0
  let hi = 0
  for (const row of rows) {
    for (const value of row) {
      if (value < lo) lo = value
      if (value > hi) hi = value
    }
  }
  const span = hi - lo || 1
  const pad = span * 0.16
  lo -= pad
  hi += pad
  const yAt = (value: number) =>
    plot.top + ((hi - value) / (hi - lo)) * plot.height
  const xAt = (index: number, count: number) =>
    plot.left +
    (count <= 1 ? plot.width / 2 : (index / (count - 1)) * plot.width)
  return { xAt, yAt }
}

export function linePath(
  values: Array<number>,
  xAt: (index: number, count: number) => number,
  yAt: (value: number) => number,
): string {
  let path = ''
  for (let index = 0; index < values.length; index++) {
    const command = index === 0 ? 'M' : 'L'
    path += `${command}${xAt(index, values.length).toFixed(1)} ${yAt(values[index]).toFixed(1)}`
  }
  return path
}

export function pointIndex(x: number, plot: Plot, count: number): number {
  if (count <= 1) return 0
  const index = Math.round(((x - plot.left) / plot.width) * (count - 1))
  if (index < 0) return 0
  if (index > count - 1) return count - 1
  return index
}
