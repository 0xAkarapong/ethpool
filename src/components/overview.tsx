import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import type { OverviewData, OverviewResult } from '@/lib/chain'
import {
  axisMax,
  feeLevel,
  formatAge,
  formatGwei,
  formatNumber,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import { ErrorBanner, PageHeader } from './shell'

const FEE_TEXT = {
  low: 'text-fee-low',
  medium: 'text-fee-mid',
  high: 'text-fee-high',
} as const

const FEE_BAR = {
  low: 'bg-fee-low-bar',
  medium: 'bg-fee-mid-bar',
  high: 'bg-fee-high-bar',
} as const

const TIER_BG = {
  low: 'border-fee-low-bar/50 bg-fee-low-bg text-fee-low',
  medium: 'border-fee-mid-bar/60 bg-fee-mid-bg text-fee-mid',
  high: 'border-fee-high-bar/50 bg-fee-high-bg text-fee-high',
} as const

export function Overview({
  result,
  cached,
  onRefresh,
}: {
  result: OverviewResult
  cached: OverviewData | null
  onRefresh: () => void
}) {
  const data = result.ok ? result : cached
  const [now, setNow] = useState(result.updatedAt)

  useEffect(() => {
    setNow(result.updatedAt)
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [result.updatedAt])

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <PageHeader
        title="Overview"
        subtitle="How much it costs to get a payment into the next batch"
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
        <Dashboard data={data} now={now} />
      ) : (
        <p className="text-sm text-muted-foreground">No cached block yet.</p>
      )}
    </div>
  )
}

function Dashboard({ data, now }: { data: OverviewData; now: number }) {
  const baseLevel = feeLevel(data.baseFeeGwei)
  const mediumLevel = feeLevel(data.suggested.medium)
  const max = axisMax(data.history)

  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Price now"
          value={formatGwei(data.baseFeeGwei)}
          unit="gwei"
          caption="What the next batch charges"
          tone={FEE_TEXT[baseLevel]}
        />
        <Metric
          label="A fair offer"
          value={formatGwei(data.suggested.medium)}
          unit="gwei"
          caption="Enough for a normal payment"
          tone={FEE_TEXT[mediumLevel]}
        />
        <Metric
          label="Latest block"
          value={formatNumber(data.latest.number)}
          caption={formatAge(now, data.latest.timestamp)}
        />
        <Metric
          label="Pending"
          value={data.pending === null ? '—' : formatNumber(data.pending)}
          unit={data.pending === null ? undefined : 'payments'}
          caption={
            data.pending === null
              ? 'This RPC does not publish the mempool size'
              : `${formatNumber(data.latest.txCount)} confirmed in the latest block`
          }
        />
      </section>

      <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="rounded-[10px] border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-medium">Price to get in</h2>
              <p className="text-[13px] text-muted-foreground">
                Each bar is one batch of payments, oldest to newest. A taller
                bar means people paid more to be included.
              </p>
            </div>
            <span
              className={cn(
                'rounded-md border px-2 py-1 text-xs font-medium',
                TIER_BG[baseLevel],
              )}
            >
              Now {formatGwei(data.baseFeeGwei)} gwei
            </span>
          </div>
          <div className="mt-4 flex gap-2">
            <div className="flex h-40 flex-col justify-between text-[11px] text-muted-foreground">
              <span>{formatAxis(max)}</span>
              <span>{formatAxis(max / 2)}</span>
              <span>0</span>
            </div>
            <div className="flex h-40 flex-1 items-end gap-[3px]">
              {data.history.map((value, index) => (
                <div
                  key={`${data.latest.number}-${index}`}
                  title={`${formatGwei(value)} gwei`}
                  className={cn(
                    'min-w-0 flex-1 rounded-[3px]',
                    FEE_BAR[feeLevel(value)],
                  )}
                  style={{ height: `${Math.max(2, (value / max) * 160)}px` }}
                />
              ))}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <Legend swatch="bg-fee-low-bar" label="Under 17 gwei" />
            <Legend swatch="bg-fee-mid-bar" label="17–22 gwei" />
            <Legend swatch="bg-fee-high-bar" label="Over 22 gwei" />
          </div>
        </div>

        <div
          id="fees"
          className="scroll-mt-6 rounded-[10px] border bg-card p-5"
        >
          <h2 className="text-base font-medium">What to offer</h2>
          <p className="text-[13px] text-muted-foreground">
            Low waits longer. High gets in sooner.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <Tier label="Low" value={data.suggested.low} />
            <Tier label="Medium" value={data.suggested.medium} />
            <Tier label="High" value={data.suggested.high} />
          </div>
        </div>
      </section>

      <section className="rounded-[10px] border bg-card p-5">
        <h2 className="text-base font-medium">Recent blocks</h2>
        <p className="text-[13px] text-muted-foreground">Newest first</p>
        <div className="mt-4 overflow-x-auto">
          <div className="grid min-w-[640px] grid-cols-[1.3fr_0.7fr_1.6fr_0.8fr_0.5fr] px-2 pb-2 text-xs text-muted-foreground">
            <span>Block</span>
            <span>Age</span>
            <span>How full</span>
            <span className="text-right">Price</span>
            <span className="text-right">Payments</span>
          </div>
          {data.blocks.map((block) => {
            const percent = Math.round((block.gasUsed / block.gasLimit) * 100)
            const level = feeLevel(block.baseFeeGwei)
            return (
              <Link
                key={block.hash}
                to="/block/$blockId"
                params={{ blockId: String(block.number) }}
                className="grid min-w-[640px] grid-cols-[1.3fr_0.7fr_1.6fr_0.8fr_0.5fr] items-center border-t px-2 py-3 text-sm"
              >
                <span className="font-medium">
                  #{formatNumber(block.number)}
                </span>
                <span className="text-muted-foreground">
                  {formatAge(now, block.timestamp)}
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-1.5 w-[120px] rounded-full bg-muted">
                    <span
                      className="block h-1.5 rounded-full bg-foreground/70"
                      style={{ width: `${Math.min(100, percent)}%` }}
                    />
                  </span>
                  <span className="text-muted-foreground">{percent}%</span>
                </span>
                <span className={cn('text-right font-medium', FEE_TEXT[level])}>
                  {formatGwei(block.baseFeeGwei)}
                </span>
                <span className="text-right">
                  {formatNumber(block.txCount)}
                </span>
              </Link>
            )
          })}
        </div>
      </section>
    </>
  )
}

function Metric({
  label,
  value,
  unit,
  caption,
  tone = 'text-foreground',
}: {
  label: string
  value: string
  unit?: string
  caption: string
  tone?: string
}) {
  return (
    <div className="rounded-[10px] border bg-card p-5">
      <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 flex items-end gap-1.5">
        <span className={cn('font-heading text-3xl font-medium', tone)}>
          {value}
        </span>
        {unit ? (
          <span className="pb-1 text-sm text-muted-foreground">{unit}</span>
        ) : null}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
    </div>
  )
}

function Tier({ label, value }: { label: string; value: number }) {
  const level = feeLevel(value)
  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium',
        TIER_BG[level],
      )}
    >
      <span>{label}</span>
      <span>{formatGwei(value)} gwei</span>
    </div>
  )
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('size-2 rounded-sm', swatch)} />
      {label}
    </span>
  )
}

function formatAxis(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}
