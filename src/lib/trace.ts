import { formatEth } from './format'

export type SearchHit =
  | { ok: true; kind: 'address'; address: string }
  | { ok: true; kind: 'ens'; name: string }
  | { ok: true; kind: 'tx'; hash: string }
  | { ok: true; kind: 'block'; blockId: string }
  | { ok: false; message: string }

const ADDRESS = /^0x[0-9a-f]{40}$/
const HASH = /^0x[0-9a-f]{64}$/
const BLOCK = /^\d{1,12}$/
// shortcut: ascii .eth labels only, widen this when a name needs unicode normalization
const ENS = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+eth$/
const BAD_QUERY =
  'Enter an address, an ENS name, a transaction hash, or a block number.'

export function classifyQuery(raw: string): SearchHit {
  const query = raw.trim().replace(/\.+$/, '')
  if (!query) return { ok: false, message: BAD_QUERY }
  if (BLOCK.test(query)) return { ok: true, kind: 'block', blockId: query }
  const hex = query.toLowerCase()
  const prefixed = hex.startsWith('0x') ? hex : `0x${hex}`
  if (ADDRESS.test(prefixed))
    return { ok: true, kind: 'address', address: prefixed }
  if (HASH.test(prefixed)) return { ok: true, kind: 'tx', hash: prefixed }
  if (ENS.test(hex)) return { ok: true, kind: 'ens', name: hex }
  return { ok: false, message: BAD_QUERY }
}

export function normalizeAddress(raw: string): string | null {
  const hit = classifyQuery(raw)
  if (!hit.ok || hit.kind !== 'address') return null
  return hit.address
}

export type TransferRow = {
  hash: string
  from: string
  to: string | null
  valueWei: bigint
  time: number
}

export type Hop = {
  hash: string
  direction: 'in' | 'out'
  counterparty: string
  amountEth: string
  addressTo: string
  txTo: string
}

// shortcut: newest 20 value moves from one indexer page, page older hops when a trace needs them
const WINDOW = 20

function amountEth(wei: bigint): string {
  const coarse = formatEth(wei)
  if (wei === 0n || coarse !== '0.0000') return coarse
  const [whole, fraction = ''] = formatEth(wei, 18).split('.')
  const trimmed = fraction.replace(/0+$/, '')
  return `${whole}.${trimmed === '' ? '0' : trimmed}`
}

export function normalizeTransfers(
  subject: string,
  rows: Array<TransferRow>,
): Array<Hop> {
  const mine = subject.toLowerCase()
  const seen = new Set<string>()
  const hops: Array<Hop> = []
  const ordered = [...rows].sort((a, b) => b.time - a.time)
  for (const row of ordered) {
    if (row.valueWei <= 0n) continue
    const from = row.from.toLowerCase()
    const to = row.to?.toLowerCase() ?? null
    const outgoing = from === mine
    const incoming = to === mine
    if (!outgoing && !incoming) continue
    const counterparty = outgoing ? to : from
    if (!counterparty || !ADDRESS.test(counterparty)) continue
    const hash = row.hash.toLowerCase()
    const direction = outgoing ? 'out' : 'in'
    const key = `${hash}:${direction}:${counterparty}:${row.valueWei}`
    if (seen.has(key)) continue
    seen.add(key)
    hops.push({
      hash,
      direction,
      counterparty,
      amountEth: amountEth(row.valueWei),
      addressTo: `/address/${counterparty}`,
      txTo: `/tx/${hash}`,
    })
    if (hops.length >= WINDOW) break
  }
  return hops
}

export type KeyValueStore = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export const TRACK_KEY = 'ethpool-tracked'

// shortcut: 24 addresses in this browser, move to an account when traces are shared
const TRACK_LIMIT = 24

export function readTracked(store: KeyValueStore): Array<string> {
  const raw = store.getItem(TRACK_KEY)
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((item) => {
      if (typeof item !== 'string') return []
      const address = normalizeAddress(item)
      return address ? [address] : []
    })
  } catch {
    return []
  }
}

export function trackAddress(
  store: KeyValueStore,
  address: string,
): Array<string> {
  const normalized = normalizeAddress(address)
  const current = readTracked(store)
  if (!normalized) return current
  const next = [
    normalized,
    ...current.filter((item) => item !== normalized),
  ].slice(0, TRACK_LIMIT)
  store.setItem(TRACK_KEY, JSON.stringify(next))
  return next
}

export function untrackAddress(
  store: KeyValueStore,
  address: string,
): Array<string> {
  const normalized = normalizeAddress(address)
  const next = readTracked(store).filter((item) => item !== normalized)
  store.setItem(TRACK_KEY, JSON.stringify(next))
  return next
}
