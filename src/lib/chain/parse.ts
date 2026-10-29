import type { BlockSummary } from './types'
import type { TokenLog } from '../tokens'
import { asHex, hexToGwei, hexToNumber, isRecord } from './hex'

export type RpcTx = {
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
  input: string
}

export type RpcReceipt = {
  transactionHash: string
  gasUsed: string
  effectiveGasPrice?: string
  blockNumber?: string
  status?: string
}

export function receiptLogs(value: unknown): Array<TokenLog> {
  if (!isRecord(value) || !Array.isArray(value.logs)) return []
  const logs: Array<TokenLog> = []
  for (const entry of value.logs) {
    if (!isRecord(entry) || typeof entry.address !== 'string') continue
    const topics = Array.isArray(entry.topics)
      ? entry.topics.filter(
          (topic): topic is string => typeof topic === 'string',
        )
      : []
    logs.push({
      address: entry.address,
      topics,
      data: typeof entry.data === 'string' ? entry.data : '0x',
    })
  }
  return logs
}

export function txKind(type: string | undefined): string {
  if (type === '0x2') return 'EIP-1559'
  if (type === '0x1') return 'Access list'
  if (type === '0x3' || type === '0x4') return 'Blob'
  return 'Legacy'
}

export function effectivePrice(tx: RpcTx, baseFee: bigint): bigint {
  if (tx.maxFeePerGas && tx.maxPriorityFeePerGas) {
    const max = BigInt(tx.maxFeePerGas)
    const withTip = baseFee + BigInt(tx.maxPriorityFeePerGas)
    return withTip < max ? withTip : max
  }
  return BigInt(tx.gasPrice ?? '0x0')
}

export function asFeeHistory(value: unknown) {
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
  const oldestBlock =
    typeof value.oldestBlock === 'string'
      ? hexToNumber(value.oldestBlock)
      : null
  return { baseFeePerGas, reward, oldestBlock }
}

export function asBlock(value: unknown): BlockSummary | null {
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

export function asFullBlock(value: unknown): {
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

export function asTx(value: unknown): RpcTx | null {
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
    input:
      typeof value.input === 'string'
        ? value.input
        : typeof value.data === 'string'
          ? value.data
          : '0x',
  }
}

export function asReceipt(value: unknown): RpcReceipt | null {
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
    status: typeof value.status === 'string' ? value.status : undefined,
  }
}

export function receiptMap(value: unknown): Map<string, RpcReceipt> {
  const map = new Map<string, RpcReceipt>()
  if (!Array.isArray(value)) return map
  for (const entry of value) {
    const receipt = asReceipt(entry)
    if (receipt?.transactionHash)
      map.set(receipt.transactionHash.toLowerCase(), receipt)
  }
  return map
}
