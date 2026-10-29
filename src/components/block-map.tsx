import { Link, useParams } from '@tanstack/react-router'
import { useState } from 'react'
import type { ReactNode } from 'react'
import type { BlockResult, TxCell } from '@/lib/chain'
import {
  feeHeat,
  formatGwei,
  formatNumber,
  formatUtcTime,
  shortAddress,
} from '@/lib/format'
import { treemap } from '@/lib/treemap'
import { cn } from '@/lib/utils'
import { BlockChain } from './block-chain'
import { ErrorBanner, PageHeader } from './shell'

const MAP_W = 788
const MAP_H = 620

export function BlockMap({
  result,
  cached = null,
  onRefresh,
}: {
  result: BlockResult
  cached?: Extract<BlockResult, { ok: true }> | null
  onRefresh: () => void
}) {
  const data = result.ok ? result : cached
  const [picked, setPicked] = useState<string | null>(null)
  const txs = data ? data.txs : []
  const selected = txs.find((tx) => tx.hash === picked) ?? largest(txs)
  const cells = treemap(
    txs.map((tx) => ({ ...tx, value: Math.max(tx.gas, 1) })),
    MAP_W,
    MAP_H,
  )
  const fees = txs.map((tx) => tx.feeGwei)
  const tone = feeHeat(fees)
  const params = useParams({ strict: false }) as { blockId?: string }
  const atTip = !params.blockId || params.blockId === 'latest'

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <PageHeader
        title={data ? `Block ${formatNumber(data.block.number)}` : 'Block'}
        subtitle={
          data
            ? `Included ${formatUtcTime(data.block.timestamp * 1000)}. Each tile is one payment. Bigger means more gas. Color compares fees inside this block.`
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
      {data ? (
        <>
          <BlockChain
            blocks={data.nearby}
            active={data.block.number}
            updatedAt={data.updatedAt}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="grid flex-1 gap-3 sm:grid-cols-3">
              <Stat
                label="Base fee"
                value={`${formatGwei(data.block.baseFeeGwei)} gwei`}
              />
              <Stat label="How full" value={fullness(data.block)} />
              <Stat label="Payments" value={formatNumber(data.block.txCount)} />
            </div>
            <div className="flex gap-2">
              {data.block.number > 0 ? (
                <Pager
                  blockId={String(data.block.number - 1)}
                  label="Previous"
                />
              ) : null}
              {atTip ? (
                <span className="rounded-lg border px-3 py-2 text-sm text-muted-foreground">
                  Latest
                </span>
              ) : (
                <Pager blockId={String(data.block.number + 1)} label="Next" />
              )}
            </div>
          </div>
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="rounded-[10px] border bg-card p-4">
              <FeeScale tone={tone} fees={fees} />
              <div className="relative mt-3 aspect-[788/620] w-full overflow-hidden rounded-lg bg-background">
                {cells.map((cell) => {
                  const active = cell.hash === selected?.hash
                  const paint = tone(cell.feeGwei)
                  const labeled =
                    (cell.w > 56 && cell.h > 22) ||
                    (active && cell.w > 36 && cell.h > 16)
                  return (
                    <button
                      key={cell.hash}
                      type="button"
                      title={`${formatGwei(cell.feeGwei)} gwei · ${formatNumber(cell.gas)} gas`}
                      aria-label={`${shortAddress(cell.hash)} ${formatGwei(cell.feeGwei)} gwei`}
                      aria-pressed={active}
                      onClick={() => setPicked(cell.hash)}
                      className={cn(
                        'absolute overflow-hidden rounded-[3px] border-0 p-0 text-left outline-none hover:brightness-125',
                        active && 'z-10',
                      )}
                      style={{
                        left: `calc(${(cell.x / MAP_W) * 100}% + 1.5px)`,
                        top: `calc(${(cell.y / MAP_H) * 100}% + 1.5px)`,
                        width: `max(0px, calc(${(cell.w / MAP_W) * 100}% - 3px))`,
                        height: `max(0px, calc(${(cell.h / MAP_H) * 100}% - 3px))`,
                        background: paint.color,
                        boxShadow: active
                          ? cell.w < 48 || cell.h < 28
                            ? `inset 0 0 0 2px ${paint.ink}, 0 0 0 3px ${paint.ink}`
                            : `inset 0 0 0 2px ${paint.ink}`
                          : undefined,
                      }}
                    >
                      {labeled ? (
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
            </div>
            <div className="flex flex-col gap-4">
              {selected ? (
                <Detail
                  tx={selected}
                  baseFee={data.block.baseFeeGwei}
                  tone={tone}
                />
              ) : null}
              <HighestFees
                txs={txs}
                tone={tone}
                picked={selected?.hash ?? null}
                onPick={setPicked}
              />
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

function Detail({
  tx,
  baseFee,
  tone,
}: {
  tx: TxCell
  baseFee: number
  tone: (gwei: number) => { color: string }
}) {
  return (
    <aside className="rounded-[10px] border bg-card p-5">
      <p className="text-[13px] font-medium text-muted-foreground">
        Fee this payment paid
      </p>
      <p
        className="mt-1 font-heading text-3xl font-medium"
        style={{ color: tone(tx.feeGwei).color }}
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
        <Row label="Ether sent">{etherSent(tx.valueEth)}</Row>
        <Row label="Minimum fee in this batch">{`${formatGwei(baseFee)} gwei`}</Row>
      </dl>
      <Link
        to="/tx/$hash"
        params={{ hash: tx.hash }}
        className="mt-5 inline-flex rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
      >
        Open this payment
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

export function heatGradient(
  tone: (gwei: number) => { color: string },
  fees: Array<number>,
): Array<string> {
  const live = fees.filter((fee) => fee > 0)
  const low = live.length ? Math.min(...live) : 0
  const high = live.length ? Math.max(...live) : 0
  if (high <= low) return [tone(low).color, tone(low).color]
  return [0, 0.2, 0.4, 0.6, 0.8, 1].map(
    (step) => tone(low * (high / low) ** step).color,
  )
}

function etherSent(valueEth: string): string {
  // shortcut: block values are 4 decimal places, so dust also reads as zero
  return valueEth === '0.0000' ? '0 ETH' : `${valueEth} ETH`
}

function FeeScale({
  tone,
  fees,
}: {
  tone: (gwei: number) => { color: string }
  fees: Array<number>
}) {
  const live = fees.filter((fee) => fee > 0)
  const low = live.length ? Math.min(...live) : 0
  const high = live.length ? Math.max(...live) : 0
  const stops = heatGradient(tone, fees)
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>{formatGwei(low)}</span>
      <span
        className="h-2 flex-1 rounded-full"
        style={{
          background: `linear-gradient(90deg, ${stops.join(', ')})`,
        }}
      />
      <span>{formatGwei(high)} gwei</span>
    </div>
  )
}

function Pager({ blockId, label }: { blockId: string; label: string }) {
  return (
    <Link
      to="/block/$blockId"
      params={{ blockId }}
      className="rounded-lg border bg-card px-3 py-2 text-sm font-medium"
    >
      {label}
    </Link>
  )
}

function HighestFees({
  txs,
  tone,
  picked,
  onPick,
}: {
  txs: Array<TxCell>
  tone: (gwei: number) => { color: string }
  picked: string | null
  onPick: (hash: string) => void
}) {
  const hot = [...txs].sort((a, b) => b.feeGwei - a.feeGwei).slice(0, 6)
  if (hot.length === 0) return null
  return (
    <div className="rounded-[10px] border bg-card p-4">
      <p className="text-xs text-muted-foreground">Highest fees</p>
      <ul className="mt-2 space-y-1">
        {hot.map((tx) => (
          <li key={tx.hash}>
            <button
              type="button"
              onClick={() => onPick(tx.hash)}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted',
                tx.hash === picked && 'bg-muted',
              )}
            >
              <span
                className="size-2.5 shrink-0 rounded-sm"
                style={{ background: tone(tx.feeGwei).color }}
              />
              <span className="w-14 shrink-0 font-medium">
                {formatGwei(tx.feeGwei)}
              </span>
              <span className="truncate text-muted-foreground">
                {shortAddress(tx.hash)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-xl font-medium">{value}</p>
    </div>
  )
}

function fullness(block: { gasUsed: number; gasLimit: number }): string {
  if (block.gasLimit <= 0) return '—'
  return `${Math.round((block.gasUsed / block.gasLimit) * 100)}%`
}

function largest(txs: Array<TxCell>): TxCell | null {
  return txs.reduce<TxCell | null>(
    (best, tx) => (best === null || tx.gas > best.gas ? tx : best),
    null,
  )
}
