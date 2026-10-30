import { createServerFn } from '@tanstack/react-start'
import type {
  SupplyPoint,
  SupplyRate,
  SupplyResult,
  SupplyWindow,
} from '../supply'
import { SUPPLY_WINDOWS } from '../supply'

const SERIES_URL = 'https://ultrasound.money/api/v2/fees/supply-over-time'
const RATES_URL = 'https://ultrasound.money/api/v2/fees/gauge-rates'

type RawPoint = { supply: number; timestamp: string }
type RawRate = {
  burn_rate_yearly: { eth: number }
  issuance_rate_yearly: { eth: number }
  supply_growth_rate_yearly: number
}

// shortcut: public RPCs cannot total supply or replay issuance since the merge, so this reads ultrasound.money. Replace it when we index the chain ourselves.
export async function loadSupply(): Promise<SupplyResult> {
  const [series, rates] = await Promise.all([
    readJson(SERIES_URL),
    readJson(RATES_URL),
  ])
  const history = allSeries(series)
  const points = history.since_merge
  const mapped = mapRates(rates)
  const issued = mapped.d1.issuedEthPerYear
  return {
    ok: true,
    host: 'ultrasound.money',
    updatedAt: Date.now(),
    asOf: stampOf(series),
    supply: points[points.length - 1].supply,
    mergeSupply: points[0].supply,
    issuedEthPerYear: issued,
    points,
    series: history,
    rates: mapped,
  }
}

export const getSupply = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SupplyResult> => {
    try {
      return await loadSupply()
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not load the ETH supply.'
      return {
        ok: false,
        host: 'ultrasound.money',
        updatedAt: Date.now(),
        message: /fetch|network|timed out|timeout|abort/i.test(message)
          ? 'Could not load the ETH supply.'
          : message,
      }
    }
  },
)

async function readJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(8_000),
    headers: { accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`Supply source returned ${response.status}`)
  return response.json()
}

function allSeries(body: unknown): Record<SupplyWindow, Array<SupplyPoint>> {
  const series = {} as Record<SupplyWindow, Array<SupplyPoint>>
  for (const window of SUPPLY_WINDOWS) series[window] = seriesOf(body, window)
  return series
}

function seriesOf(body: unknown, key: string): Array<SupplyPoint> {
  const rows = field(body, key)
  if (!Array.isArray(rows)) throw new Error('Supply history was unreadable.')
  const points = rows.flatMap((row) => {
    if (!isPoint(row)) return []
    const t = Math.floor(Date.parse(row.timestamp) / 1000)
    if (!Number.isFinite(t)) return []
    return [{ t, supply: row.supply }]
  })
  points.sort((a, b) => a.t - b.t)
  if (points.length < 2) throw new Error('Supply history was incomplete.')
  return points
}

function mapRates(body: unknown): Record<SupplyWindow, SupplyRate> {
  const rates = {} as Record<SupplyWindow, SupplyRate>
  for (const window of SUPPLY_WINDOWS) {
    const row = field(body, window)
    if (!isRate(row)) throw new Error('Supply pace was unreadable.')
    rates[window] = {
      growth: row.supply_growth_rate_yearly,
      burnEthPerYear: row.burn_rate_yearly.eth,
      issuedEthPerYear: row.issuance_rate_yearly.eth,
    }
  }
  return rates
}

function stampOf(body: unknown): number {
  const timestamp = field(body, 'timestamp')
  const ms = typeof timestamp === 'string' ? Date.parse(timestamp) : NaN
  if (!Number.isFinite(ms)) throw new Error('Supply history was unreadable.')
  return Math.floor(ms / 1000)
}

function field(body: unknown, key: string): unknown {
  if (!body || typeof body !== 'object') return undefined
  return (body as Record<string, unknown>)[key]
}

function isPoint(value: unknown): value is RawPoint {
  if (!value || typeof value !== 'object') return false
  const row = value as { supply?: unknown; timestamp?: unknown }
  return (
    typeof row.supply === 'number' &&
    Number.isFinite(row.supply) &&
    typeof row.timestamp === 'string'
  )
}

function isRate(value: unknown): value is RawRate {
  if (!value || typeof value !== 'object') return false
  const row = value as {
    supply_growth_rate_yearly?: unknown
    burn_rate_yearly?: { eth?: unknown }
    issuance_rate_yearly?: { eth?: unknown }
  }
  return (
    typeof row.supply_growth_rate_yearly === 'number' &&
    typeof row.burn_rate_yearly?.eth === 'number' &&
    typeof row.issuance_rate_yearly?.eth === 'number'
  )
}
