import { useEffect, useState } from 'react'
import type { PointerEvent } from 'react'
import type { SupplyData, SupplyResult, SupplyWindow } from '@/lib/supply'
import { formatUtcStamp } from '@/lib/format'
import {
  bitcoinScaled,
  chartFrame,
  deltasFrom,
  formatSupplyCount,
  formatSupplyDelta,
  formatYearlyRate,
  linePath,
  paceSentence,
  pointIndex,
  proofOfWorkSupply,
  sinceMergeLabel,
  SUPPLY_PLOT,
  SUPPLY_WINDOWS,
  supplyAge,
  WINDOW_LABEL,
} from '@/lib/supply'
import { ErrorBanner, PageHeader } from './shell'

const VIEW_W = SUPPLY_PLOT.left + SUPPLY_PLOT.width + 96
const VIEW_H = SUPPLY_PLOT.top + SUPPLY_PLOT.height + 16

export function SupplyView({
  result,
  cached,
  onRefresh,
}: {
  result: SupplyResult
  cached: SupplyData | null
  onRefresh: () => void
}) {
  const data = result.ok ? result : cached
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <PageHeader
        title="Supply"
        subtitle="How many ETH exist, and how fast that number is changing"
        updatedAt={result.updatedAt}
        live={result.ok}
        problem="other"
        onRefresh={onRefresh}
      />
      {result.ok ? null : (
        <ErrorBanner message={result.message} onRetry={onRefresh} />
      )}
      {data ? (
        <SupplyPanel data={data} />
      ) : (
        <p className="text-sm text-muted-foreground">No cached supply yet.</p>
      )}
    </div>
  )
}

export function SupplyPanel({ data }: { data: SupplyData }) {
  const [now, setNow] = useState(data.updatedAt)
  const [pace, setPace] = useState<SupplyWindow>('since_merge')
  const [showBtc, setShowBtc] = useState(false)
  const [showPow, setShowPow] = useState(false)
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    setNow(data.updatedAt)
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [data.updatedAt])

  const history = data.series[pace]
  const count = history.length
  const active = hover === null ? count - 1 : Math.min(hover, count - 1)
  const point = history[active]
  const rate = data.rates[pace]
  const sinceMerge = pace === 'since_merge'
  const base = sinceMerge ? data.mergeSupply : history[0].supply
  const eth = deltasFrom(
    base,
    history.map((row) => row.supply),
  )
  const rows = [eth]
  const btc =
    sinceMerge && showBtc
      ? deltasFrom(data.mergeSupply, bitcoinScaled(data.points))
      : null
  const pow =
    sinceMerge && showPow
      ? deltasFrom(
          data.mergeSupply,
          proofOfWorkSupply(data.points, data.issuedEthPerYear),
        )
      : null
  if (btc) rows.push(btc)
  if (pow) rows.push(pow)
  const frame = chartFrame(rows, SUPPLY_PLOT)
  const baseline = frame.yAt(0)
  const endX = frame.xAt(count - 1, count)
  const endY = frame.yAt(eth[count - 1])
  const ink = rate.growth < 0 ? 'var(--fee-high)' : 'var(--fee-low)'

  function follow(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * VIEW_W
    setHover(pointIndex(x, SUPPLY_PLOT, count))
  }

  const deltaLabel = sinceMerge
    ? `${formatSupplyDelta(point.supply - data.mergeSupply)} since mining stopped`
    : `${formatSupplyDelta(point.supply - history[0].supply)} in this window`

  return (
    <section className="rounded-[10px] border bg-card p-5 text-card-foreground">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-muted-foreground">
            ETH in existence
          </p>
          <p className="mt-1 font-heading text-3xl font-medium">
            {formatSupplyCount(point.supply)}
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">{deltaLabel}</p>
        </div>
        <div className="text-right">
          <p className="text-[13px] text-muted-foreground">
            Since merge{' '}
            <span className="font-medium text-foreground">
              {sinceMergeLabel(now)}
            </span>
          </p>
          <p className="mt-1 text-sm font-medium" style={{ color: ink }}>
            {formatYearlyRate(rate.growth)}
          </p>
        </div>
      </div>

      <div
        className="mt-4 flex flex-wrap gap-2"
        role="group"
        aria-label="Time window"
      >
        {SUPPLY_WINDOWS.map((item) => {
          const on = item === pace
          return (
            <button
              key={item}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setPace(item)
                setHover(null)
              }}
              className="rounded-lg border px-3 py-2 text-sm font-medium"
              style={{
                background: on ? 'var(--secondary)' : 'transparent',
                color: on
                  ? 'var(--secondary-foreground)'
                  : 'var(--muted-foreground)',
              }}
            >
              {WINDOW_LABEL[item]}
            </button>
          )
        })}
      </div>

      <p className="mt-4 text-sm">
        <span className="font-medium">{formatUtcStamp(point.t)}</span>
        <span className="text-muted-foreground">{` · ${deltaLabel}`}</span>
      </p>
      <p className="mt-1 text-[13px] text-muted-foreground">
        {sinceMerge
          ? 'Above the line, more ETH exists than when mining stopped. Below it, some was destroyed.'
          : 'The flat line is where this window started. The curve is the change since then.'}
      </p>

      <div className="relative mt-2">
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="block h-64 w-full touch-none sm:h-72"
          role="img"
          aria-label={`ETH supply, ${WINDOW_LABEL[pace]}, ${formatYearlyRate(rate.growth)}`}
          onPointerMove={follow}
          onPointerDown={follow}
        >
          <line
            x1={SUPPLY_PLOT.left}
            x2={SUPPLY_PLOT.left + SUPPLY_PLOT.width}
            y1={baseline}
            y2={baseline}
            stroke="var(--muted-foreground)"
            strokeOpacity="0.45"
          />
          {pow ? (
            <path
              d={linePath(pow, frame.xAt, frame.yAt)}
              fill="none"
              stroke="var(--fee-mid)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
          ) : null}
          {btc ? (
            <path
              d={linePath(btc, frame.xAt, frame.yAt)}
              fill="none"
              stroke="var(--muted-foreground)"
              strokeWidth="1.5"
            />
          ) : null}
          <path
            d={linePath(eth, frame.xAt, frame.yAt)}
            fill="none"
            stroke="var(--foreground)"
            strokeWidth="2.4"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <line
            x1={frame.xAt(active, count)}
            x2={frame.xAt(active, count)}
            y1={SUPPLY_PLOT.top}
            y2={SUPPLY_PLOT.top + SUPPLY_PLOT.height}
            stroke="var(--muted-foreground)"
            strokeOpacity="0.35"
          />
          <circle cx={endX} cy={endY} r="4" fill="var(--foreground)" />
          <circle
            cx={frame.xAt(active, count)}
            cy={frame.yAt(eth[active])}
            r="4.5"
            fill="var(--card)"
            stroke="var(--foreground)"
            strokeWidth="2"
          />
        </svg>
      </div>

      {sinceMerge ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <LegendDot color="var(--foreground)" label="ETH" pressed />
          <LegendDot
            color="var(--muted-foreground)"
            label="BTC"
            pressed={showBtc}
            onClick={() => setShowBtc((value) => !value)}
          />
          <LegendDot
            color="var(--fee-mid)"
            label="ETH (PoW)"
            pressed={showPow}
            onClick={() => setShowPow((value) => !value)}
          />
        </div>
      ) : null}
      {sinceMerge && (showBtc || showPow) ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {showBtc ? "BTC is ether growing at Bitcoin's pace. " : ''}
          {showPow ? 'ETH (PoW) is ether if mining had continued. ' : ''}
          Those lines use the same scale, so the ETH line looks flatter.
        </p>
      ) : null}

      <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
        {paceSentence(pace, rate)}
      </p>
      <p className="mt-4 text-xs text-muted-foreground">
        Updated {supplyAge(now, data.asOf)}. Totals are counted by
        ultrasound.money from public chain data.
      </p>
    </section>
  )
}

function LegendDot({
  color,
  label,
  pressed,
  onClick,
}: {
  color: string
  label: string
  pressed: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium"
      style={{
        color: pressed ? 'var(--foreground)' : 'var(--muted-foreground)',
        background: pressed ? 'var(--secondary)' : 'transparent',
      }}
    >
      <span
        className="size-2 rounded-full"
        style={{ background: color, opacity: pressed ? 1 : 0.45 }}
      />
      {label}
    </button>
  )
}
