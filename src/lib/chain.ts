import { createServerFn } from '@tanstack/react-start'
import { addressName, formatEth, formatWeiAsGwei } from './format'
import {
  normalizeAddress,
  normalizeTransfers,
  type Hop,
  type TransferRow,
} from './trace'

const ENDPOINTS = [
  'https://eth.drpc.org',
  'https://ethereum-rpc.publicnode.com',
  'https://1rpc.io/eth',
  'https://rpc.flashbots.net',
  'https://eth-mainnet.public.blastapi.io',
  'https://virginia.rpc.blxrbdn.com',
]

type RpcTx = {
  hash: string
  from: string
  to: string | null
  value: string
  gas: string
  gasPrice?: string
  maxFeePerGas?: string
  maxPriorityFeePerGas?: string
  type?: string
  blockNumber?: string | null
}

type RpcReceipt = {
  transactionHash: string
  gasUsed: string
  effectiveGasPrice?: string
  blockNumber?: string
}

export type BlockSummary = {
  number: number
  hash: string
  parentHash: string
  timestamp: number
  gasUsed: number
  gasLimit: number
  baseFeeGwei: number
  baseFeeWei: string
  txCount: number
}

export type OverviewData = {
  ok: true
  host: string
  updatedAt: number
  baseFeeGwei: number
  suggested: { low: number; medium: number; high: number }
  latest: BlockSummary
  pending: number | null
  history: Array<number>
  blocks: Array<BlockSummary>
}

export type OverviewResult =
  OverviewData | { ok: false; host: string; updatedAt: number; message: string }

export type TxCell = {
  hash: string
  from: string
  to: string | null
  toName: string | null
  gas: number
  feeGwei: number
  valueEth: string
}

export type BlockResult =
  | {
      ok: true
      host: string
      updatedAt: number
      block: BlockSummary
      txs: Array<TxCell>
    }
  | { ok: false; host: string; updatedAt: number; message: string }

export type TxFlowResult =
  | {
      ok: true
      host: string
      updatedAt: number
      hash: string
      blockNumber: number | null
      timestamp: number | null
      from: string
      to: string | null
      toName: string | null
      valueEth: string
      burnedEth: string
      tipEth: string
      feeEth: string
      totalEth: string
      gasUsed: number
      effectiveGwei: string
      maxGwei: string
      priorityGwei: string
      kind: string
    }
  | { ok: false; host: string; updatedAt: number; message: string }

export const getOverview = createServerFn({ method: 'GET' }).handler(
  async () => {
    try {
      return await loadOverview()
    } catch (error) {
      return fail(error)
    }
  },
)

export const getBlockView = createServerFn({ method: 'GET' })
  .validator((blockId: string) => blockId)
  .handler(async ({ data }): Promise<BlockResult> => {
    if (data !== 'latest' && !/^\d{1,12}$/.test(data))
      return fail(new Error('Invalid block'))
    try {
      return await loadBlock(data)
    } catch (error) {
      return fail(error)
    }
  })

export const getTxFlow = createServerFn({ method: 'GET' })
  .validator((hash: string) => hash)
  .handler(async ({ data }): Promise<TxFlowResult> => {
    if (!/^0x[0-9a-fA-F]{64}$/.test(data))
      return fail(new Error('Invalid transaction'))
    try {
      return await loadTx(data)
    } catch (error) {
      return fail(error)
    }
  })

export type AddressResult =
  | {
      ok: true
      host: string
      updatedAt: number
      address: string
      balanceEth: string
      txCount: number
      contract: boolean
      transfers: Array<Hop>
      historyMessage: string | null
    }
  | { ok: false; host: string; updatedAt: number; message: string }

export const getAddressView = createServerFn({ method: 'GET' })
  .validator((address: string) => address)
  .handler(async ({ data }): Promise<AddressResult> => loadAddress(data))

export async function loadAddress(address: string): Promise<AddressResult> {
  const normalized = normalizeAddress(address)
  if (!normalized) return fail(new Error('Invalid address'))
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

function fail(error: unknown): {
  ok: false
  host: string
  updatedAt: number
  message: string
} {
  const message =
    error instanceof Error ? error.message : 'Could not reach Ethereum'
  const reachable =
    /could not reach|timeout|timed out|abort|fetch|network/i.test(message)
  return {
    ok: false,
    host: 'eth.drpc.org',
    updatedAt: Date.now(),
    message: reachable ? 'Could not reach Ethereum' : message,
  }
}

export async function loadOverview(): Promise<OverviewData> {
  const { results } = await callFirst([
    { method: 'eth_feeHistory', params: ['0x28', 'latest', [10, 50, 90]] },
    { method: 'eth_blockNumber', params: [] },
  ])
  const history = asFeeHistory(results[0])
  const latestNumber = hexToNumber(asHex(results[1]))
  const blockCalls = Array.from({ length: 8 }, (_, index) => ({
    method: 'eth_getBlockByNumber',
    params: [hexOf(latestNumber - index), false],
  }))
  const blocksResult = await callFirst(blockCalls)
  const blocks = blocksResult.results.flatMap((entry) => {
    const block = asBlock(entry)
    return block ? [block] : []
  })
  if (blocks.length === 0) throw new Error('Latest block was empty')

  const included = history.baseFeePerGas.slice(0, -1).map(hexToGwei)
  const nextBase = hexToGwei(
    history.baseFeePerGas[history.baseFeePerGas.length - 1],
  )
  const tips = history.reward?.[history.reward.length - 1] ?? []
  const tip = (index: number) => (tips[index] ? hexToGwei(tips[index]) : 0)

  let pending: number | null = null
  try {
    const count = await callFirst([
      { method: 'eth_getBlockTransactionCountByNumber', params: ['pending'] },
    ])
    if (typeof count.results[0] === 'string')
      pending = hexToNumber(count.results[0])
  } catch {
    // shortcut: public RPCs often hide the mempool, show an empty pending count until one publishes it
    pending = null
  }

  return {
    ok: true,
    host: blocksResult.host,
    updatedAt: Date.now(),
    baseFeeGwei: nextBase,
    suggested: {
      low: nextBase + tip(0),
      medium: nextBase + tip(1),
      high: nextBase + tip(2),
    },
    latest: blocks[0],
    pending,
    history: included.slice(-40),
    blocks,
  }
}

async function loadBlock(blockId: string): Promise<BlockResult> {
  const tag = blockId === 'latest' ? 'latest' : hexOf(Number(blockId))
  const { url, host, results } = await callFirst([
    { method: 'eth_getBlockByNumber', params: [tag, true] },
  ])
  const summary = asBlock(results[0])
  const block = asFullBlock(results[0])
  if (!summary || !block) throw new Error('Block not found')

  let receipts = new Map<string, RpcReceipt>()
  const receiptCall = {
    method: 'eth_getBlockReceipts',
    params: [block.hash],
  }
  try {
    const receiptResult = await callAt(url, [receiptCall])
    receipts = receiptMap(receiptResult.results[0])
  } catch {
    receipts = new Map()
  }
  // 1rpc rejects eth_getBlockReceipts. Without receipts every cell uses the
  // gas limit, so one high-cap transaction fills the map.
  if (receipts.size === 0 && block.transactions.length > 0) {
    try {
      const receiptResult = await callFirst([receiptCall])
      receipts = receiptMap(receiptResult.results[0])
    } catch {
      receipts = new Map()
    }
  }

  const baseFee = block.baseFeePerGas ? BigInt(block.baseFeePerGas) : 0n
  const txs = block.transactions.map((tx) => {
    const receipt = receipts.get(tx.hash.toLowerCase())
    const gas = receipt ? hexToNumber(receipt.gasUsed) : hexToNumber(tx.gas)
    const price = receipt?.effectiveGasPrice
      ? BigInt(receipt.effectiveGasPrice)
      : effectivePrice(tx, baseFee)
    return {
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      toName: addressName(tx.to),
      gas,
      feeGwei: Number(price) / 1e9,
      valueEth: formatEth(BigInt(tx.value)),
    }
  })

  return { ok: true, host, updatedAt: Date.now(), block: summary, txs }
}

async function loadTx(hash: string): Promise<TxFlowResult> {
  const { url, host, results } = await callFirst([
    { method: 'eth_getTransactionByHash', params: [hash] },
    { method: 'eth_getTransactionReceipt', params: [hash] },
  ])
  const tx = asTx(results[0])
  const receipt = asReceipt(results[1])
  if (!tx || !receipt) throw new Error('Transaction not found')

  const blockNumber = receipt.blockNumber
    ? hexToNumber(receipt.blockNumber)
    : null
  let timestamp: number | null = null
  let baseFee = 0n
  if (blockNumber !== null) {
    const blockResult = await callAt(url, [
      { method: 'eth_getBlockByNumber', params: [hexOf(blockNumber), false] },
    ])
    const block = asBlock(blockResult.results[0])
    if (block) {
      timestamp = block.timestamp
      baseFee = BigInt(block.baseFeeWei)
    }
  }

  const gasUsed = BigInt(receipt.gasUsed)
  const effective = BigInt(receipt.effectiveGasPrice ?? tx.gasPrice ?? '0x0')
  const fee = gasUsed * effective
  const burned = gasUsed * baseFee
  const tip = fee > burned ? fee - burned : 0n
  const value = BigInt(tx.value)

  return {
    ok: true,
    host,
    updatedAt: Date.now(),
    hash: tx.hash,
    blockNumber,
    timestamp,
    from: tx.from,
    to: tx.to,
    toName: addressName(tx.to),
    valueEth: formatEth(value),
    burnedEth: formatEth(burned),
    tipEth: formatEth(tip),
    feeEth: formatEth(fee),
    totalEth: formatEth(value + fee),
    gasUsed: hexToNumber(receipt.gasUsed),
    effectiveGwei: formatWeiAsGwei(effective),
    maxGwei: formatWeiAsGwei(BigInt(tx.maxFeePerGas ?? tx.gasPrice ?? '0x0')),
    priorityGwei: formatWeiAsGwei(
      BigInt(
        tx.maxPriorityFeePerGas ??
          (effective > baseFee ? effective - baseFee : 0n),
      ),
    ),
    kind: txKind(tx.type),
  }
}

// JSON-RPC cannot list an address's transfers. This public explorer API needs no key.
const INDEXER =
  'https://api.routescan.io/v2/network/mainnet/evm/1/etherscan/api'

async function loadTransfers(address: string): Promise<Array<Hop>> {
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

async function fetchTxList(
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

function asTransferRow(value: unknown): Array<TransferRow> {
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

function parseWei(value: unknown): bigint | null {
  if (typeof value !== 'string' || !/^(0x[0-9a-fA-F]+|\d+)$/.test(value))
    return null
  return BigInt(value)
}

function txKind(type: string | undefined): string {
  if (type === '0x2') return 'EIP-1559'
  if (type === '0x1') return 'Access list'
  if (type === '0x3' || type === '0x4') return 'Blob'
  return 'Legacy'
}

function effectivePrice(tx: RpcTx, baseFee: bigint): bigint {
  if (tx.maxFeePerGas && tx.maxPriorityFeePerGas) {
    const max = BigInt(tx.maxFeePerGas)
    const withTip = baseFee + BigInt(tx.maxPriorityFeePerGas)
    return withTip < max ? withTip : max
  }
  return BigInt(tx.gasPrice ?? '0x0')
}

type Call = { method: string; params: Array<unknown> }

const quietUntil = new Map<string, number>()

function isUnreachable(error: unknown): boolean {
  const message =
    error instanceof Error
      ? `${error.message} ${'cause' in error ? String(error.cause) : ''}`
      : ''
  return /could not reach|fetch|timeout|network|econnreset|abort|socket hang up|too many requests|rate limit/i.test(
    message,
  )
}

// One hung public RPC must not hold the page. Bun closes a dev request that
// sends no bytes for 10s, which drops the block map before it renders.
const ATTEMPT_MS = 4_000

async function callFirst(calls: Array<Call>) {
  const now = Date.now()
  const open = ENDPOINTS.filter((url) => (quietUntil.get(url) ?? 0) < now)
  const urls = open.length > 0 ? open : ENDPOINTS
  const controllers = urls.map(() => new AbortController())
  const timer = setTimeout(() => {
    for (const controller of controllers) controller.abort()
  }, ATTEMPT_MS)
  const attempts = urls.map((url, index) =>
    callAt(url, calls, controllers[index].signal).then(
      (result) => {
        for (const [other, controller] of controllers.entries()) {
          if (other !== index) controller.abort()
        }
        return result
      },
      (error: unknown) => {
        // An abort we issued means another host already won, or the 4s cap hit.
        if (!controllers[index].signal.aborted && isUnreachable(error)) {
          quietUntil.set(url, Date.now() + 20_000)
        }
        throw error
      },
    ),
  )

  try {
    return await Promise.any(attempts)
  } catch (error) {
    const list = error instanceof AggregateError ? error.errors : [error]
    const last = list.find((entry) => entry instanceof Error)
    throw last instanceof Error ? last : new Error('Could not reach Ethereum')
  } finally {
    clearTimeout(timer)
    for (const attempt of attempts) attempt.catch(() => {})
  }
}

async function callAt(
  url: string,
  calls: Array<Call>,
  signal = AbortSignal.timeout(ATTEMPT_MS),
) {
  const results = await mapPool(calls, 3, (call) => callOne(url, call, signal))
  return { url, host: new URL(url).host, results }
}

async function callOne(
  url: string,
  call: Call,
  signal: AbortSignal,
): Promise<unknown> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: call.method,
      params: call.params,
    }),
    signal,
  })
  const body: unknown = await response.json().catch(() => null)
  if (!isRecord(body)) throw new Error('Could not reach Ethereum')
  if (body.error) {
    const message =
      isRecord(body.error) && typeof body.error.message === 'string'
        ? body.error.message
        : 'RPC error'
    throw new Error(message)
  }
  if (!response.ok) throw new Error('Could not reach Ethereum')
  return body.result
}

async function mapPool<T, TResult>(
  items: Array<T>,
  limit: number,
  run: (item: T) => Promise<TResult>,
): Promise<Array<TResult>> {
  const results = new Array<TResult>(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const index = next
      next += 1
      results[index] = await run(items[index])
    }
  }
  const workers = Math.min(limit, items.length)
  await Promise.all(Array.from({ length: workers }, () => worker()))
  return results
}

function asFeeHistory(value: unknown) {
  if (
    !isRecord(value) ||
    !Array.isArray(value.baseFeePerGas) ||
    value.baseFeePerGas.length < 2
  ) {
    throw new Error('Fee history was missing')
  }
  const baseFeePerGas = value.baseFeePerGas.map(asHex)
  const reward = Array.isArray(value.reward)
    ? value.reward.map((row) => (Array.isArray(row) ? row.map(asHex) : []))
    : undefined
  return { baseFeePerGas, reward }
}

function asBlock(value: unknown): BlockSummary | null {
  if (
    !isRecord(value) ||
    typeof value.number !== 'string' ||
    typeof value.hash !== 'string'
  )
    return null
  const txCount = Array.isArray(value.transactions)
    ? value.transactions.length
    : 0
  const gasLimit =
    typeof value.gasLimit === 'string' ? hexToNumber(value.gasLimit) : 1
  return {
    number: hexToNumber(value.number),
    hash: value.hash,
    parentHash:
      typeof value.parentHash === 'string' ? value.parentHash : value.hash,
    timestamp:
      typeof value.timestamp === 'string' ? hexToNumber(value.timestamp) : 0,
    gasUsed: typeof value.gasUsed === 'string' ? hexToNumber(value.gasUsed) : 0,
    gasLimit: Math.max(1, gasLimit),
    baseFeeGwei:
      typeof value.baseFeePerGas === 'string'
        ? hexToGwei(value.baseFeePerGas)
        : 0,
    baseFeeWei:
      typeof value.baseFeePerGas === 'string' ? value.baseFeePerGas : '0x0',
    txCount,
  }
}

function asFullBlock(value: unknown): {
  number: string
  hash: string
  parentHash: string
  timestamp: string
  gasUsed: string
  gasLimit: string
  baseFeePerGas?: string
  transactions: Array<RpcTx>
} | null {
  if (
    !isRecord(value) ||
    typeof value.number !== 'string' ||
    typeof value.hash !== 'string'
  )
    return null
  if (!Array.isArray(value.transactions)) return null
  const transactions = value.transactions
    .map(asTx)
    .filter((tx): tx is RpcTx => tx !== null)
  return {
    number: value.number,
    hash: value.hash,
    parentHash:
      typeof value.parentHash === 'string' ? value.parentHash : value.hash,
    timestamp: typeof value.timestamp === 'string' ? value.timestamp : '0x0',
    gasUsed: typeof value.gasUsed === 'string' ? value.gasUsed : '0x0',
    gasLimit: typeof value.gasLimit === 'string' ? value.gasLimit : '0x1',
    baseFeePerGas:
      typeof value.baseFeePerGas === 'string' ? value.baseFeePerGas : undefined,
    transactions,
  }
}

function asTx(value: unknown): RpcTx | null {
  if (typeof value === 'string') return null
  if (
    !isRecord(value) ||
    typeof value.hash !== 'string' ||
    typeof value.from !== 'string'
  )
    return null
  return {
    hash: value.hash,
    from: value.from,
    to: typeof value.to === 'string' ? value.to : null,
    value: typeof value.value === 'string' ? value.value : '0x0',
    gas: typeof value.gas === 'string' ? value.gas : '0x0',
    gasPrice: typeof value.gasPrice === 'string' ? value.gasPrice : undefined,
    maxFeePerGas:
      typeof value.maxFeePerGas === 'string' ? value.maxFeePerGas : undefined,
    maxPriorityFeePerGas:
      typeof value.maxPriorityFeePerGas === 'string'
        ? value.maxPriorityFeePerGas
        : undefined,
    type: typeof value.type === 'string' ? value.type : undefined,
    blockNumber:
      typeof value.blockNumber === 'string' ? value.blockNumber : null,
  }
}

function asReceipt(value: unknown): RpcReceipt | null {
  if (!isRecord(value) || typeof value.gasUsed !== 'string') return null
  return {
    transactionHash:
      typeof value.transactionHash === 'string' ? value.transactionHash : '',
    gasUsed: value.gasUsed,
    effectiveGasPrice:
      typeof value.effectiveGasPrice === 'string'
        ? value.effectiveGasPrice
        : undefined,
    blockNumber:
      typeof value.blockNumber === 'string' ? value.blockNumber : undefined,
  }
}

function receiptMap(value: unknown): Map<string, RpcReceipt> {
  const map = new Map<string, RpcReceipt>()
  if (!Array.isArray(value)) return map
  for (const entry of value) {
    const receipt = asReceipt(entry)
    if (receipt?.transactionHash)
      map.set(receipt.transactionHash.toLowerCase(), receipt)
  }
  return map
}

function asHex(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('0x'))
    throw new Error('Unexpected RPC value')
  return value
}

function hexToNumber(hex: string): number {
  return Number(BigInt(hex))
}

function hexToGwei(hex: string): number {
  return Number(BigInt(hex)) / 1e9
}

function hexOf(value: number): string {
  return `0x${value.toString(16)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
