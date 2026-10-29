import type { CallView } from '../call'
import type { Hop } from '../trace'
import type { TokenMove } from '../tokens'

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
  history: Array<{ gwei: number; time: number }>
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
      nearby: Array<BlockSummary>
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
      call: CallView
      succeeded: boolean | null
      tokens: Array<TokenMove>
      tokenMore: number
    }
  | { ok: false; host: string; updatedAt: number; message: string }

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
