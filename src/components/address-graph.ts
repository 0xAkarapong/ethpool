import type { Hop } from '@/lib/trace'

// shortcut: six wallets on this board, open a wallet's page to keep walking
export const TRACE_CAP = 6
// shortcut: twelve biggest payments each way, page the rest when a trace needs them
export const RIBBONS_PER_SIDE = 12

export type TraceStep = {
  address: string
  kind: string
  balance: string
  hops: Array<Hop>
  historyMessage: string | null
  via: {
    amountEth: string
    hash: string
    direction: Hop['direction']
  } | null
}

export function followPath(
  path: Array<TraceStep>,
  next: TraceStep,
): Array<TraceStep> {
  const existing = path.findIndex((step) => step.address === next.address)
  if (existing >= 0) return path.slice(0, existing + 1)
  if (path.length >= TRACE_CAP) return path
  return [...path, next]
}

export type FlowRibbon = {
  address: string
  amount: number
  label: string
  hash: string
  direction: 'in' | 'out'
}

/** One ribbon per wallet per direction. Repeated payments add up. The hash is the largest split. */
export function walletRibbons(hops: Array<Hop>): {
  incoming: Array<FlowRibbon>
  outgoing: Array<FlowRibbon>
} {
  const groups = new Map<
    string,
    FlowRibbon & {
      biggest: number
    }
  >()
  for (const hop of hops) {
    const value = Number(hop.amountEth)
    const amount = Number.isFinite(value) ? value : 0
    if (!(amount > 0)) continue
    const key = `${hop.direction}|${hop.counterparty}`
    const current = groups.get(key)
    if (!current) {
      groups.set(key, {
        address: hop.counterparty,
        amount,
        label: hop.amountEth,
        hash: hop.hash,
        direction: hop.direction,
        biggest: amount,
      })
      continue
    }
    current.amount += amount
    if (amount >= current.biggest) {
      current.biggest = amount
      current.hash = hop.hash
    }
  }
  const ribbons = [...groups.values()].map((ribbon) => ({
    address: ribbon.address,
    amount: ribbon.amount,
    label: labelEth(String(ribbon.amount)),
    hash: ribbon.hash,
    direction: ribbon.direction,
  }))
  const take = (direction: FlowRibbon['direction']) =>
    ribbons
      .filter((ribbon) => ribbon.direction === direction)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, RIBBONS_PER_SIDE)
  return { incoming: take('in'), outgoing: take('out') }
}

/** Bar thickness in px. Square root, so a small payment stays visible beside a large one. */
export function ribbonHeights(amounts: Array<number>): Array<number> {
  const min = 6
  const max = 28
  const weights = amounts.map((amount) => Math.sqrt(Math.max(0, amount)))
  const peak = Math.max(0, ...weights)
  if (peak === 0) return amounts.map(() => min)
  return weights.map((weight) =>
    Math.round(min + (weight / peak) * (max - min)),
  )
}

export function labelEth(amountEth: string): string {
  const value = Number(amountEth)
  if (!Number.isFinite(value) || value === 0) return amountEth
  const digits = value >= 1 ? 2 : value >= 0.0001 ? 4 : 8
  const [whole, fraction = ''] = value.toFixed(digits).split('.')
  const trimmed = fraction.replace(/0+$/, '')
  const shown = trimmed ? `${whole}.${trimmed}` : whole
  return shown === '0' ? amountEth : shown
}
