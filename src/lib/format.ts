export type FeeLevel = 'low' | 'medium' | 'high'
export type UsageLevel = 'calm' | 'steady' | 'busy'

const HEAT_STOPS: Array<[number, [number, number, number]]> = [
  [8, [11, 107, 69]],
  [16, [18, 163, 106]],
  [22, [224, 161, 0]],
  [45, [249, 115, 22]],
  [90, [225, 29, 48]],
]

export function feeLevel(gwei: number): FeeLevel {
  if (gwei < 17) return 'low'
  if (gwei < 22) return 'medium'
  return 'high'
}

export function usageLevel(percent: number): UsageLevel {
  if (percent < 60) return 'calm'
  if (percent < 82) return 'steady'
  return 'busy'
}

export function formatGwei(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatWeiAsGwei(wei: bigint): string {
  return formatGwei(Number(wei) / 1e9)
}

export function formatEth(wei: bigint, digits = 4): string {
  const negative = wei < 0n
  const value = negative ? -wei : wei
  const whole = value / 10n ** 18n
  const fraction = (value % 10n ** 18n)
    .toString()
    .padStart(18, '0')
    .slice(0, digits)
  return `${negative ? '-' : ''}${whole.toString()}.${fraction}`
}

export function formatNumber(value: number): string {
  return value.toLocaleString('en-US')
}

export function formatUtcTime(ms: number): string {
  const date = new Date(ms)
  const hh = String(date.getUTCHours()).padStart(2, '0')
  const mm = String(date.getUTCMinutes()).padStart(2, '0')
  const ss = String(date.getUTCSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss} UTC`
}

export function formatAge(nowMs: number, timestampSec: number): string {
  const seconds = Math.max(0, Math.round(nowMs / 1000 - timestampSec))
  if (seconds < 60) return `${seconds} seconds ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function shortAddress(address: string): string {
  if (address.length <= 18) return address
  return `${address.slice(0, 10)}…${address.slice(-6)}`
}

export function axisMax(values: number[]): number {
  const peak = Math.max(1, ...values)
  const padded = peak * 1.15
  const step =
    padded > 80 ? 20 : padded > 30 ? 10 : padded > 10 ? 5 : padded > 2 ? 1 : 0.5
  return Math.ceil(padded / step) * step
}

export type FeeTone = { color: string; ink: string }

// Absolute stops assume multi-gwei fees. A quiet block is all under the first
// stop, so color by where each fee sits among the others.
export function feeHeat(values: Array<number>): (gwei: number) => FeeTone {
  const sorted = values.filter((value) => value > 0).sort((a, b) => a - b)
  const lo = sorted[Math.floor((sorted.length - 1) * 0.08)] ?? 1
  const hi = sorted[Math.ceil((sorted.length - 1) * 0.92)] ?? lo
  const span = Math.log(Math.max(hi, lo * 1.05)) - Math.log(lo)
  return (gwei) => {
    const t =
      span < 0.25
        ? 0.12
        : clamp((Math.log(Math.max(gwei, lo)) - Math.log(lo)) / span, 0, 1)
    const channels = heatChannels(t)
    const light =
      0.299 * channels[0] + 0.587 * channels[1] + 0.114 * channels[2] > 150
    return { color: rgb(channels), ink: light ? '#1a1a1a' : '#fff' }
  }
}

function heatChannels(t: number): [number, number, number] {
  const last = HEAT_STOPS.length - 1
  const scaled = t * last
  const index = Math.min(last - 1, Math.floor(scaled))
  const local = scaled - index
  const from = HEAT_STOPS[index][1]
  const to = HEAT_STOPS[index + 1][1]
  return [
    mix(from[0], to[0], local),
    mix(from[1], to[1], local),
    mix(from[2], to[2], local),
  ]
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function mix(from: number, to: number, t: number): number {
  return Math.round(from + (to - from) * t)
}

function rgb(channels: [number, number, number]): string {
  return `rgb(${channels[0]} ${channels[1]} ${channels[2]})`
}

const NAMES: Record<string, string> = {
  '0x3fc91a3afd70395cd496c647d5a6cc9d4b2ae7': 'Uniswap Universal Router',
  '0x7a250d5630b4cf539739df2c5dacb4c659f2488d': 'Uniswap V2 Router',
  '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45': 'Uniswap Swap Router',
  '0x1111111254eeb25477b68fb85ed929f73a960582': '1inch v5 Router',
  '0x0000000000000000000000000000000000000000': 'Burn address',
}

export function addressName(address: string | null): string | null {
  if (!address) return null
  return NAMES[address.toLowerCase()] ?? null
}
