import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import type { BlockResult, TxCell } from '@/lib/chain'
import {
  feeLevel,
  formatGwei,
  formatNumber,
  heatColor,
  shortAddress,
} from '@/lib/format'
import { treemap } from '@/lib/treemap'
import { cn } from '@/lib/utils'
import { ErrorBanner, PageHeader } from './shell'

const MAP_W = 788
const MAP_H = 520

export function BlockMap({
  result,
  onRefresh,
}: {
  result: BlockResult
  onRefresh: () => void
}) {
  const [picked, setPicked] = useState<string | null>(null)
  const txs = result.ok ? result.txs : []
  const selected = txs.find((tx) => tx.hash === picked) ?? largest(txs)
  const cells = treemap(
    txs.map((tx) => ({ ...tx, value: Math.max(tx.gas, 1) })),
    MAP_W,
    MAP_H,
  )

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <PageHeader
        title={
          result.ok ? `Block ${formatNumber(result.block.number)}` : 'Block'
        }
        subtitle={
          result.ok
            ? `${formatNumber(result.block.txCount)} transactions · base fee ${formatGwei(result.block.baseFeeGwei)} gwei`
            : 'Transaction map'
        }
        updatedAt={result.updatedAt}
        live={result.ok}
        problem={
          result.ok || result.message === 'Could not reach Ethereum'
            ? 'offline'
            : 'other'
        }
        onRefresh={onRefresh}
      />
      {result.ok ? null : (
        <ErrorBanner message={result.message} onRetry={onRefresh} />
      )}
      {result.ok ? (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="rounded-[10px] border bg-card p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-base font-medium">Transactions</h2>
              <p className="text-xs text-muted-foreground">
                Area is gas. Color is effective fee.
              </p>
            </div>
            <div className="relative mt-3 aspect-[788/520] w-full overflow-hidden rounded-lg bg-muted">
              {cells.map((cell) => {
                const active = cell.hash === selected?.hash
                return (
                  <button
                    key={cell.hash}
                    type="button"
                    aria-label={`${shortAddress(cell.hash)} ${formatGwei(cell.feeGwei)} gwei`}
                    onClick={() => setPicked(cell.hash)}
                    className={cn(
                      'absolute overflow-hidden border-0 p-0 text-left',
                      active && 'z-10 outline outline-2 outline-white',
                    )}
                    style={{
                      left: `${(cell.x / MAP_W) * 100}%`,
                      top: `${(cell.y / MAP_H) * 100}%`,
                      width: `${(cell.w / MAP_W) * 100}%`,
                      height: `${(cell.h / MAP_H) * 100}%`,
                      background: heatColor(cell.feeGwei),
                      boxShadow: active
                        ? 'inset 0 0 0 1px rgba(0,0,0,0.45)'
                        : undefined,
                    }}
                  >
                    {cell.w > 46 && cell.h > 22 ? (
                      <span className="px-1 text-[11px] font-medium text-white">
                        {formatGwei(cell.feeGwei)}
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Parent {shortAddress(result.block.parentHash)}
            </p>
          </div>
          {selected ? (
            <Detail tx={selected} baseFee={result.block.baseFeeGwei} />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function Detail({ tx, baseFee }: { tx: TxCell; baseFee: number }) {
  const level = feeLevel(tx.feeGwei)
  return (
    <aside className="rounded-[10px] border bg-card p-5">
      <p className="text-[13px] font-medium text-muted-foreground">Selected</p>
      <p
        className={cn(
          'mt-1 font-heading text-3xl font-medium',
          level === 'low' && 'text-fee-low',
          level === 'medium' && 'text-fee-mid',
          level === 'high' && 'text-fee-high',
        )}
      >
        {formatGwei(tx.feeGwei)}
        <span className="ml-1 text-sm font-normal text-muted-foreground">
          gwei
        </span>
      </p>
      <dl className="mt-4 space-y-3 text-sm">
        <Row label="Hash" value={shortAddress(tx.hash)} />
        <Row label="From" value={shortAddress(tx.from)} />
        <Row
          label="To"
          value={
            tx.to ? (tx.toName ?? shortAddress(tx.to)) : 'Contract creation'
          }
        />
        <Row label="Gas" value={formatNumber(tx.gas)} />
        <Row label="Value" value={`${tx.valueEth} ETH`} />
        <Row label="Block base fee" value={`${formatGwei(baseFee)} gwei`} />
      </dl>
      <Link
        to="/tx/$hash"
        params={{ hash: tx.hash }}
        className="mt-5 inline-flex rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
      >
        Open transaction flow
      </Link>
    </aside>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium break-all">{value}</dd>
    </div>
  )
}

function largest(txs: Array<TxCell>): TxCell | null {
  return txs.reduce<TxCell | null>(
    (best, tx) => (best === null || tx.gas > best.gas ? tx : best),
    null,
  )
}
