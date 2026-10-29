import { createServerFn } from '@tanstack/react-start'
import { addressName, formatEth } from '../format'
import { callAt, callFirst } from '../rpc'
import { fail } from './fail'
import { hexOf, hexToNumber } from './hex'
import { asBlock, asFullBlock, effectivePrice, receiptMap } from './parse'
import type { BlockResult, BlockSummary } from './types'

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

export async function loadBlock(blockId: string): Promise<BlockResult> {
  const tag = blockId === 'latest' ? 'latest' : hexOf(Number(blockId))
  const { url, host, results } = await callFirst([
    { method: 'eth_getBlockByNumber', params: [tag, true] },
  ])
  const summary = asBlock(results[0])
  const block = asFullBlock(results[0])
  if (!summary || !block) throw new Error('Block not found')
  const nearbyPromise = loadNearby(summary.number)

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

  return {
    ok: true,
    host,
    updatedAt: Date.now(),
    block: summary,
    nearby: await nearbyPromise,
    txs,
  }
}

export async function loadNearby(number: number): Promise<Array<BlockSummary>> {
  const calls = Array.from({ length: 8 }, (_, index) => ({
    method: 'eth_getBlockByNumber',
    params: [hexOf(Math.max(0, number - index)), false],
  }))
  try {
    const result = await callFirst(calls)
    const seen = new Set<number>()
    const nearby: Array<BlockSummary> = []
    for (const entry of result.results) {
      const block = asBlock(entry)
      if (!block || seen.has(block.number)) continue
      seen.add(block.number)
      nearby.push(block)
    }
    return nearby
  } catch {
    return []
  }
}
