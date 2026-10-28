import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import type { ReactNode } from 'react'
import type { BlockResult, TxCell } from '@/lib/chain'
import {
  feeHeat,
  feeLevel,
  formatGwei,
  formatNumber,
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
  const tone = feeHeat(txs.map((tx) => tx.feeGwei))

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <PageHeader
        title={
          result.ok ? `Block ${formatNumber(result.block.number)}` : 'Block'
        }
        subtitle={
          result.ok
            ? `${formatNumber(result.block.txCount)} payments packed into this batch`
            : 'What was inside this batch'
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
              <h2 className="text-base font-medium">
                Every payment in this batch
              </h2>
              <p className="text-right text-xs text-muted-foreground">
                Bigger tile, more of the work. Greener paid less.
              </p>
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span>Lower fee</span>
              <span
                className="h-2 flex-1 rounded-full"
                style={{
                  background:
                    'linear-gradient(90deg, rgb(11 107 69), rgb(224 161 0), rgb(225 29 48))',
                }}
              />
              <span>Higher fee</span>
            </div>
            <div className="relative mt-3 aspect-[788/520] w-full overflow-hidden rounded-lg bg-muted">
              {cells.map((cell) => {
                const active = cell.hash === selected?.hash
                const paint = tone(cell.feeGwei)
                return (
                  <button
                    key={cell.hash}
                    type="button"
                    aria-label={`${shortAddress(cell.hash)} ${formatGwei(cell.feeGwei)} gwei`}
                    onClick={() => setPicked(cell.hash)}
                    className={cn(
                      'absolute overflow-hidden rounded-[3px] border-0 p-0 text-left outline-none',
                      active && 'z-10',
                    )}
                    style={{
                      left: `calc(${(cell.x / MAP_W) * 100}% + 1.5px)`,
                      top: `calc(${(cell.y / MAP_H) * 100}% + 1.5px)`,
                      width: `max(0px, calc(${(cell.w / MAP_W) * 100}% - 3px))`,
                      height: `max(0px, calc(${(cell.h / MAP_H) * 100}% - 3px))`,
                      background: paint.color,
                      boxShadow: active
                        ? `inset 0 0 0 2px ${paint.ink}`
                        : undefined,
                    }}
                  >
                    {cell.w > 72 && cell.h > 28 ? (
                      <span
                        className="px-1.5 text-[11px] font-medium"
                        style={{ color: paint.ink }}
                      >
                        {formatGwei(cell.feeGwei)}
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
            {result.block.number > 0 ? (
              <Link
                to="/block/$blockId"
                params={{ blockId: String(result.block.number - 1) }}
                className="mt-3 inline-block text-xs text-muted-foreground underline-offset-2 hover:underline"
              >
                Previous block
              </Link>
            ) : null}
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
      <p className="text-[13px] font-medium text-muted-foreground">
        Fee this payment paid
      </p>
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
        <Row label="Payment">
          <Link
            to="/tx/$hash"
            params={{ hash: tx.hash }}
            className="underline-offset-2 hover:underline"
          >
            {shortAddress(tx.hash)}
          </Link>
        </Row>
        <Row label="Sent by">
          <Link
            to="/address/$address"
            params={{ address: tx.from }}
            className="underline-offset-2 hover:underline"
          >
            {shortAddress(tx.from)}
          </Link>
        </Row>
        <Row label="Received by">
          {tx.to ? (
            <Link
              to="/address/$address"
              params={{ address: tx.to }}
              className="underline-offset-2 hover:underline"
            >
              {tx.toName ?? shortAddress(tx.to)}
            </Link>
          ) : (
            'A new program'
          )}
        </Row>
        <Row label="Gas used">{formatNumber(tx.gas)}</Row>
        <Row label="Money sent">{`${tx.valueEth} ETH`}</Row>
        <Row label="Minimum fee in this batch">{`${formatGwei(baseFee)} gwei`}</Row>
      </dl>
      <Link
        to="/tx/$hash"
        params={{ hash: tx.hash }}
        className="mt-5 inline-flex rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
      >
        See where the money went
      </Link>
    </aside>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium break-all">{children}</dd>
    </div>
  )
}

function largest(txs: Array<TxCell>): TxCell | null {
  return txs.reduce<TxCell | null>(
    (best, tx) => (best === null || tx.gas > best.gas ? tx : best),
    null,
  )
}
