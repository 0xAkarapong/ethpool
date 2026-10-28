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
  const fraction = (value % 10n ** 18n).toString().padStart(18, '0').slice(0, digits)
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
  const step = padded > 80 ? 20 : padded > 30 ? 10 : padded > 10 ? 5 : padded > 2 ? 1 : 0.5
  return Math.ceil(padded / step) * step
}

export function heatColor(gwei: number): string {
  if (gwei <= HEAT_STOPS[0][0]) return rgb(HEAT_STOPS[0][1])
  const last = HEAT_STOPS[HEAT_STOPS.length - 1]
  if (gwei >= last[0]) return rgb(last[1])
  for (let i = 1; i < HEAT_STOPS.length; i++) {
    const [end, color] = HEAT_STOPS[i]
    const [start, previous] = HEAT_STOPS[i - 1]
    if (gwei <= end) {
      const t = (gwei - start) / (end - start)
      return rgb([
        mix(previous[0], color[0], t),
        mix(previous[1], color[1], t),
        mix(previous[2], color[2], t),
      ])
    }
  }
  return rgb(last[1])
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
