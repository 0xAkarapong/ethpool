import type { TxCell } from '@/lib/chain'

const TILE_KEY = 'ethpool-block-tile'

function tileStorageKey(blockNumber: number) {
  return `${TILE_KEY}:${blockNumber}`
}

export function readTile(blockNumber: number): string | null {
  try {
    return sessionStorage.getItem(tileStorageKey(blockNumber))
  } catch {
    return null
  }
}

export function writeTile(blockNumber: number, hash: string) {
  try {
    sessionStorage.setItem(tileStorageKey(blockNumber), hash)
  } catch {
    // Private browsing can reject storage. The highlight still updates in memory.
  }
}

export function resolvePicked(
  stored: string | null,
  txs: Array<TxCell>,
): TxCell | null {
  if (stored) {
    const kept = txs.find((tx) => tx.hash === stored)
    if (kept) return kept
  }
  return largest(txs)
}

function largest(txs: Array<TxCell>): TxCell | null {
  return txs.reduce<TxCell | null>(
    (best, tx) => (best === null || tx.gas > best.gas ? tx : best),
    null,
  )
}
