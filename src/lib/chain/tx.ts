import { createServerFn } from '@tanstack/react-start'
import { describeCall, readStatus } from '../call'
import {
  addressName,
  formatEth,
  formatWeiAsGwei,
  shortAddress,
} from '../format'
import { callAt, callFirst, callMaybe, mapPool } from '../rpc'
import {
  formatTokenAmount,
  readDecimals,
  readSymbol,
  readTokenMoves,
  TOKEN_MOVE_CAP,
} from '../tokens'
import type { TokenMove } from '../tokens'
import { fail } from './fail'
import { hexOf, hexToNumber } from './hex'
import { asBlock, asReceipt, asTx, receiptLogs, txKind } from './parse'
import type { TxFlowResult } from './types'

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

export async function loadTx(hash: string): Promise<TxFlowResult> {
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
  const described = await describeTokens(
    url,
    readTokenMoves(receiptLogs(results[1])),
  )

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
    call: describeCall(tx.input, tx.to),
    succeeded: readStatus(receipt.status),
    tokens: described.tokens,
    tokenMore: described.tokenMore,
  }
}

export const SYMBOL_CALL = '0x95d89b41'
export const DECIMALS_CALL = '0x313ce567'

export async function describeTokens(
  url: string,
  moves: ReturnType<typeof readTokenMoves>,
): Promise<{ tokens: Array<TokenMove>; tokenMore: number }> {
  const shown = moves.slice(0, TOKEN_MOVE_CAP)
  if (shown.length === 0) return { tokens: [], tokenMore: 0 }
  const contracts = [...new Set(shown.map((move) => move.token))]
  const meta = new Map<string, { symbol: string; decimals: number | null }>()
  try {
    await mapPool(contracts, 4, async (token) => {
      const [symbolWord, decimalsWord] = await Promise.all([
        callMaybe(url, {
          method: 'eth_call',
          params: [{ to: token, data: SYMBOL_CALL }, 'latest'],
        }),
        callMaybe(url, {
          method: 'eth_call',
          params: [{ to: token, data: DECIMALS_CALL }, 'latest'],
        }),
      ])
      meta.set(token, {
        symbol: readSymbol(symbolWord) ?? shortAddress(token),
        decimals: readDecimals(decimalsWord),
      })
    })
  } catch {
    meta.clear()
  }
  return {
    tokenMore: Math.max(0, moves.length - shown.length),
    tokens: shown.map((move) => {
      const info = meta.get(move.token)
      const symbol = info?.symbol ?? shortAddress(move.token)
      if (move.tokenId !== null) {
        return {
          token: move.token,
          symbol,
          from: move.from,
          to: move.to,
          amount: `#${move.tokenId}`,
        }
      }
      return {
        token: move.token,
        symbol,
        from: move.from,
        to: move.to,
        amount:
          info?.decimals == null
            ? `${move.raw.toString()} units`
            : formatTokenAmount(move.raw, info.decimals),
      }
    }),
  }
}
