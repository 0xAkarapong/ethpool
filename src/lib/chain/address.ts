import { createServerFn } from '@tanstack/react-start'
import { formatEth } from '../format'
import { ATTEMPT_MS, callFirst } from '../rpc'
import { classifyQuery, normalizeAddress, normalizeTransfers } from '../trace'
import type { Hop, TransferRow } from '../trace'
import { fail } from './fail'
import { asHex, hexToNumber, isRecord } from './hex'
import type { AddressResult } from './types'

export const getAddressView = createServerFn({ method: 'GET' })
  .validator((address: string) => address)
  .handler(async ({ data }): Promise<AddressResult> => loadAddress(data))

export async function loadAddress(address: string): Promise<AddressResult> {
  const subject = await resolveSubject(address)
  if (!subject.ok) return fail(new Error(subject.message))
  const normalized = subject.address
  try {
    const [{ host, results }, history] = await Promise.all([
      callFirst([
        { method: 'eth_getBalance', params: [normalized, 'latest'] },
        { method: 'eth_getTransactionCount', params: [normalized, 'latest'] },
        { method: 'eth_getCode', params: [normalized, 'latest'] },
      ]),
      loadTransfers(normalized).then(
        (transfers) => ({ transfers, message: null as string | null }),
        (error: unknown) => ({
          transfers: [] as Array<Hop>,
          message: fail(error).message,
        }),
      ),
    ])
    const balance = BigInt(asHex(results[0]))
    const code = asHex(results[2])
    // 0xef0100 is an EIP-7702 delegation. The account is still an EOA.
    const empty = code === '0x' || code === '0x0'
    return {
      ok: true,
      host,
      updatedAt: Date.now(),
      address: normalized,
      balanceEth: formatEth(balance),
      txCount: hexToNumber(asHex(results[1])),
      contract: !empty && !code.startsWith('0xef0100'),
      transfers: history.transfers,
      historyMessage: history.message,
    }
  } catch (error) {
    return fail(error)
  }
}

// JSON-RPC cannot list an address's transfers. This public explorer API needs no key.
export const INDEXER =
  'https://api.routescan.io/v2/network/mainnet/evm/1/etherscan/api'

// Public lookup so a search for vitalik.eth does not need an API key.
export const ENS_LOOKUP = 'https://api.ensideas.com/ens/resolve/'

export async function resolveSubject(
  raw: string,
): Promise<{ ok: true; address: string } | { ok: false; message: string }> {
  const direct = normalizeAddress(raw)
  if (direct) return { ok: true, address: direct }
  const hit = classifyQuery(raw)
  if (!hit.ok || hit.kind !== 'ens')
    return { ok: false, message: 'Invalid address' }
  try {
    const response = await fetch(
      `${ENS_LOOKUP}${encodeURIComponent(hit.name)}`,
      {
        signal: AbortSignal.timeout(ATTEMPT_MS),
      },
    )
    const body: unknown = await response.json().catch(() => null)
    const found =
      isRecord(body) && typeof body.address === 'string'
        ? normalizeAddress(body.address)
        : null
    if (!response.ok || !found)
      return { ok: false, message: 'No address for that name.' }
    return { ok: true, address: found }
  } catch {
    return { ok: false, message: 'Could not resolve that name.' }
  }
}

export async function loadTransfers(address: string): Promise<Array<Hop>> {
  const lists = await Promise.all([
    fetchTxList(address, 'txlist').catch(() => null),
    fetchTxList(address, 'txlistinternal').catch(() => null),
  ])
  if (lists[0] === null && lists[1] === null)
    throw new Error('Could not reach Ethereum')
  return normalizeTransfers(
    address,
    lists.flatMap((list) => list ?? []),
  )
}

export async function fetchTxList(
  address: string,
  action: 'txlist' | 'txlistinternal',
): Promise<Array<TransferRow>> {
  const url = `${INDEXER}?module=account&action=${action}&address=${address}&page=1&offset=25&sort=desc`
  const response = await fetch(url, { signal: AbortSignal.timeout(ATTEMPT_MS) })
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok || !isRecord(body))
    throw new Error('Could not reach Ethereum')
  if (!Array.isArray(body.result)) {
    const message = typeof body.message === 'string' ? body.message : ''
    if (/no transactions|no records/i.test(message)) return []
    throw new Error('Could not reach Ethereum')
  }
  return body.result.flatMap(asTransferRow)
}

export function asTransferRow(value: unknown): Array<TransferRow> {
  if (!isRecord(value) || typeof value.hash !== 'string') return []
  if (!/^0x[0-9a-fA-F]{64}$/.test(value.hash)) return []
  if (value.isError === '1') return []
  const wei = parseWei(value.value)
  if (wei === null) return []
  return [
    {
      hash: value.hash,
      from: typeof value.from === 'string' ? value.from : '',
      to: typeof value.to === 'string' && value.to ? value.to : null,
      valueWei: wei,
      time: typeof value.timeStamp === 'string' ? Number(value.timeStamp) : 0,
    },
  ]
}

export function parseWei(value: unknown): bigint | null {
  if (typeof value !== 'string' || !/^(0x[0-9a-fA-F]+|\d+)$/.test(value))
    return null
  return BigInt(value)
}
