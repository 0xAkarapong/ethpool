import { createServerFn } from '@tanstack/react-start'
import { callFirst } from '../rpc'
import { fail } from './fail'
import { asHex, hexOf, hexToGwei, hexToNumber } from './hex'
import { asBlock, asFeeHistory } from './parse'
import type { OverviewData } from './types'

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
  const shown = included.slice(-40)
  const oldest =
    history.oldestBlock === null
      ? blocks[0].number - (shown.length - 1)
      : history.oldestBlock + (included.length - shown.length)
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
    history: feePoints(shown, oldest, blocks),
    blocks,
  }
}

export function feePoints(
  fees: Array<number>,
  oldest: number,
  known: Array<{ number: number; timestamp: number }>,
): Array<{ gwei: number; time: number }> {
  if (fees.length === 0 || known.length === 0)
    return fees.map((gwei) => ({ gwei, time: 0 }))
  const latest = known.reduce((a, b) => (a.number > b.number ? a : b))
  const earliest = known.reduce((a, b) => (a.number < b.number ? a : b))
  const span = latest.number - earliest.number
  const slot = span > 0 ? (latest.timestamp - earliest.timestamp) / span : 12
  const byNumber = new Map(
    known.map((block) => [block.number, block.timestamp]),
  )
  return fees.map((gwei, index) => {
    const number = oldest + index
    const time = byNumber.get(number)
    return {
      gwei,
      time:
        time ?? Math.round(latest.timestamp - (latest.number - number) * slot),
    }
  })
}

export const getOverview = createServerFn({ method: 'GET' }).handler(
  async () => {
    try {
      return await loadOverview()
    } catch (error) {
      return fail(error)
    }
  },
)
