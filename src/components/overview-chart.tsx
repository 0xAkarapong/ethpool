import { useState } from 'react'
import type { OverviewData } from '@/lib/chain'
import {
  axisMax,
  feeHeat,
  formatGwei,
  formatUtcClock,
  formatUtcStamp,
} from '@/lib/format'

export function FeeChart({
  history,
  latestNumber,
  baseFeeGwei,
}: {
  history: OverviewData['history']
  latestNumber: number
  baseFeeGwei: number
}) {
  const fees = history.map((point) => point.gwei)
  const max = axisMax(fees)
  const tone = feeHeat(fees)
  const priced = fees.filter((value) => value > 0)
  const cheap = priced.length ? Math.min(...priced) : 0
  const dear = priced.length ? Math.max(...priced) : 0
  const hasHistory = history.length > 0
  const ends = hasHistory
    ? chartEnds(history[0].time, history[history.length - 1].time)
    : null
  const [picked, setPicked] = useState(history.length - 1)
  const active = hasHistory
    ? Math.min(Math.max(picked, 0), history.length - 1)
    : 0
  const now = tone(baseFeeGwei)

  function choose(event: { clientX: number; currentTarget: HTMLDivElement }) {
    const rect = event.currentTarget.getBoundingClientRect()
    setPicked(barIndex(event.clientX - rect.left, rect.width, history.length))
  }

  return (
    <div className="rounded-[10px] border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-medium">Price to get in</h2>
          <p className="text-[13px] text-muted-foreground">
            Each bar is one batch of payments, oldest to newest. A taller bar
            means people paid more to be included.
          </p>
        </div>
        <span
          className="rounded-md border px-2 py-1 text-xs font-medium"
          style={{
            background: now.color,
            color: now.ink,
            borderColor: now.color,
          }}
        >
          Now {formatGwei(baseFeeGwei)} gwei
        </span>
      </div>
      <div className="mt-4 flex gap-2">
        <div className="flex h-40 flex-col justify-between text-[11px] text-muted-foreground">
          <span>{formatAxis(max)}</span>
          <span>{formatAxis(max / 2)}</span>
          <span>0</span>
        </div>
        <div className="min-w-0 flex-1">
          {hasHistory ? (
            <p className="mb-2 text-sm">
              <span className="font-medium">
                {formatUtcStamp(history[active].time)}
              </span>
              <span className="text-muted-foreground">
                {` · ${formatGwei(history[active].gwei)} gwei to get into that batch`}
              </span>
            </p>
          ) : null}
          <div
            className="flex h-40"
            onPointerDown={choose}
            onPointerMove={choose}
          >
            {history.map((point, index) => (
              <button
                key={`${latestNumber}-${index}`}
                type="button"
                onFocus={() => setPicked(index)}
                aria-label={`${formatUtcStamp(point.time)}, ${formatGwei(point.gwei)} gwei to get into that batch`}
                className={`flex h-full min-w-0 flex-1 items-end rounded-sm px-[1.5px] ${index === active ? 'bg-muted' : ''}`}
              >
                <span
                  className="w-full rounded-[3px]"
                  style={{
                    height: `${Math.max(2, (point.gwei / max) * 160)}px`,
                    background: tone(point.gwei).color,
                  }}
                />
              </button>
            ))}
          </div>
          {ends ? (
            <div className="mt-1 flex justify-between gap-3 text-[11px] text-muted-foreground">
              <span>{ends.left}</span>
              <span>{ends.right}</span>
            </div>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <Legend color={tone(cheap).color} label="Cheapest in this window" />
        <Legend color={tone(dear).color} label="Dearest in this window" />
      </div>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-2 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  )
}

export function barIndex(x: number, width: number, count: number): number {
  if (count <= 0 || width <= 0) return 0
  return Math.min(count - 1, Math.max(0, Math.floor((x / width) * count)))
}

function formatAxis(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function chartEnds(
  start: number,
  end: number,
): { left: string; right: string } {
  const a = new Date(start * 1000)
  const b = new Date(end * 1000)
  const sameDay =
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  if (!sameDay)
    return { left: formatUtcStamp(start), right: formatUtcStamp(end) }
  return {
    left: formatUtcStamp(start).replace(' UTC', ''),
    right: `${formatUtcClock(end)} UTC`,
  }
}
