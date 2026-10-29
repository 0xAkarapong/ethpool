import type {
  BlockResult,
  BlockSummary,
  OverviewData,
  TxCell,
  TxFlowResult,
} from '@/lib/chain'

const updatedAt = Date.parse('2026-10-28T14:32:18Z')
const shape = [
  0.28, 0.32, 0.3, 0.36, 0.42, 0.4, 0.48, 0.58, 0.64, 0.55, 0.46, 0.44, 0.5,
  0.62, 0.72, 0.66, 0.54, 0.48, 0.6, 0.78, 0.86, 0.76, 0.62, 0.5, 0.46, 0.58,
  0.7, 0.84, 0.92, 0.82, 0.7, 0.6, 0.54, 0.66, 0.76, 0.7, 0.58, 0.52, 0.64,
  0.74,
]

const rows: Array<[number, number, number, number]> = [
  [12, 78, 18.42, 186],
  [24, 91, 24.1, 221],
  [36, 64, 15.8, 154],
  [48, 82, 19.55, 198],
  [60, 55, 12.4, 132],
  [72, 88, 27.15, 240],
  [84, 71, 17.02, 176],
  [108, 49, 11.2, 121],
]

function block(index: number): BlockSummary {
  const [age, gasPercent, baseFeeGwei, txCount] = rows[index]
  const number = 21_084_331 - index
  return {
    number,
    hash: `0x${number.toString(16).padStart(64, 'a')}`,
    parentHash: `0x${(number - 1).toString(16).padStart(64, 'b')}`,
    timestamp: updatedAt / 1000 - age,
    gasUsed: Math.round(30_000_000 * (gasPercent / 100)),
    gasLimit: 30_000_000,
    baseFeeGwei,
    baseFeeWei: '0x0',
    txCount,
  }
}

export const overview: OverviewData = {
  ok: true,
  host: 'eth.drpc.org',
  updatedAt,
  baseFeeGwei: 18.42,
  suggested: { low: 16.2, medium: 20.8, high: 28.4 },
  latest: block(0),
  pending: 4820,
  history: shape.map((value, index) => ({
    gwei: (value / shape[39]) * 18.42,
    time: updatedAt / 1000 - (shape.length - 1 - index) * 12,
  })),
  blocks: rows.map((_, index) => block(index)),
}

export const offline = {
  ok: false as const,
  host: 'eth.drpc.org',
  updatedAt,
  message: 'Could not reach Ethereum',
}

function mapCells(): Array<TxCell> {
  let seed = 21_084_331
  const next = () => {
    seed = (seed * 16807) % 2_147_483_647
    return seed / 2_147_483_647
  }
  const cells: Array<TxCell> = Array.from({ length: 64 }, (_, index) => {
    const roll = next()
    const gas =
      roll < 0.58
        ? 21_000 + Math.floor(next() * 12_000)
        : roll < 0.84
          ? 42_000 + Math.floor(next() * 110_000)
          : 160_000 + Math.floor(next() * 320_000)
    const feeGwei =
      roll < 0.58
        ? 12 + next() * 5
        : roll < 0.84
          ? 18 + next() * 12
          : 30 + next() * 40
    return {
      hash: `0x${(index + 1).toString(16).padStart(64, 'c')}`,
      from: '0x91c4a8E2b17c09d4F0aA21e8c3b77E2a1d04c91c',
      to: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2aE7',
      toName: null,
      gas,
      feeGwei: Math.round(feeGwei * 100) / 100,
      valueEth: '0.0100',
    }
  })
  cells[3] = {
    ...cells[3],
    gas: 184_220,
    feeGwei: 42.6,
    valueEth: '1.2400',
    toName: 'Uniswap Universal Router',
  }
  return cells
}

export const blockView: BlockResult = {
  ok: true,
  host: 'eth.drpc.org',
  updatedAt,
  block: block(0),
  nearby: rows.map((_, index) => block(index)),
  txs: mapCells(),
}

export const txFlow: TxFlowResult = {
  ok: true,
  host: 'eth.drpc.org',
  updatedAt,
  hash: '0x7c2a91e4c3b77e2a1d04c91c91c4a8e2b17c09d4f0aa21e8c3b77e2a1d04c91c',
  blockNumber: 21_084_331,
  timestamp: updatedAt / 1000 - 12,
  from: '0x91c4a8E2b17c09d4F0aA21e8c3b77E2a1d04c91c',
  to: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2aE7',
  toName: 'Uniswap Universal Router',
  valueEth: '1.2400',
  burnedEth: '0.0034',
  tipEth: '0.0044',
  feeEth: '0.0078',
  totalEth: '1.2478',
  gasUsed: 184_220,
  effectiveGwei: '42.60',
  maxGwei: '48.00',
  priorityGwei: '24.20',
  kind: 'EIP-1559',
  call: {
    kind: 'call',
    name: 'run a swap',
    selector: '0x3593564c',
    known: true,
  },
  succeeded: true,
  tokens: [
    {
      token: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      symbol: 'USDC',
      from: '0x91c4a8e2b17c09d4f0aa21e8c3b77e2a1d04c91c',
      to: '0x3fc91a3afd70395cd496c647d5a6cc9d4b2ae7',
      amount: '1,250',
    },
  ],
  tokenMore: 0,
}
