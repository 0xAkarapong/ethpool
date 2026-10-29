import { useEffect, useState } from 'react'
import type { OverviewData, OverviewResult } from '@/lib/chain'
import type { FeeTone } from '@/lib/format'
import { feeHeat, formatAge, formatGwei, formatNumber } from '@/lib/format'
import { BlockChain } from './block-chain'
import { FeeChart } from './overview-chart'
import { ErrorBanner, PageHeader } from './shell'

export { barIndex } from './overview-chart'

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
  const historyTone = feeHeat(data.history.map((point) => point.gwei))
  const offerTone = feeHeat([
    data.suggested.low,
    data.suggested.medium,
    data.suggested.high,
  ])
  const full =
    data.latest.gasLimit > 0
      ? Math.round((data.latest.gasUsed / data.latest.gasLimit) * 100)
      : 0

  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Price now"
          value={formatGwei(data.baseFeeGwei)}
          unit="gwei"
          caption="What the next batch charges"
          color={historyTone(data.baseFeeGwei).color}
        />
        <Metric
          label="A fair offer"
          value={formatGwei(data.suggested.medium)}
          unit="gwei"
          caption="Enough for a normal payment"
          color={offerTone(data.suggested.medium).color}
        />
        <Metric
          label="Latest block"
          value={formatNumber(data.latest.number)}
          caption={formatAge(now, data.latest.timestamp)}
        />
        <Metric
          label="How full"
          value={`${full}%`}
          caption={`${formatNumber(data.latest.txCount)} payments in the latest block`}
        />
      </section>

      <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <FeeChart
          history={data.history}
          latestNumber={data.latest.number}
          baseFeeGwei={data.baseFeeGwei}
        />

        <div
          id="fees"
          className="scroll-mt-6 rounded-[10px] border bg-card p-5"
        >
          <h2 className="text-base font-medium">What to offer</h2>
          <p className="text-[13px] text-muted-foreground">
            Low waits longer. High gets in sooner.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <Tier
              label="Low"
              value={data.suggested.low}
              tone={offerTone(data.suggested.low)}
            />
            <Tier
              label="Medium"
              value={data.suggested.medium}
              tone={offerTone(data.suggested.medium)}
            />
            <Tier
              label="High"
              value={data.suggested.high}
              tone={offerTone(data.suggested.high)}
            />
          </div>
        </div>
      </section>

      <section className="rounded-[10px] border bg-card p-5">
        <h2 className="text-base font-medium">Recent blocks</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Newest on the left. Open a block to see its payments.
        </p>
        <div className="mt-4">
          <BlockChain
            blocks={data.blocks}
            active={data.latest.number}
            pending={data.pending}
            updatedAt={data.updatedAt}
          />
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
  color,
}: {
  label: string
  value: string
  unit?: string
  caption: string
  color?: string
}) {
  return (
    <div className="rounded-[10px] border bg-card p-5">
      <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 flex items-end gap-1.5">
        <span className="font-heading text-3xl font-medium" style={{ color }}>
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

function Tier({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: FeeTone
}) {
  return (
    <div
      className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium"
      style={{
        background: tone.color,
        color: tone.ink,
        borderColor: tone.color,
      }}
    >
      <span>{label}</span>
      <span>{formatGwei(value)} gwei</span>
    </div>
  )
}
