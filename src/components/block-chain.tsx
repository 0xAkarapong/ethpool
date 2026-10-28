import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import type { BlockSummary } from '@/lib/chain'
import { formatAge, formatGwei, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

// Base fee is under 17 gwei on a quiet chain, so fee bands paint every block
// the same green. Fullness is what actually differs from block to block.
const FULLNESS_STOPS: Array<[number, number, number]> = [
  [76, 29, 149],
  [67, 56, 202],
  [37, 99, 235],
  [8, 145, 178],
]

export function fullnessTone(percent: number): string {
  const t = Math.min(1, Math.max(0, percent / 100))
  const scaled = t * (FULLNESS_STOPS.length - 1)
  const index = Math.min(FULLNESS_STOPS.length - 2, Math.floor(scaled))
  const local = scaled - index
  const from = FULLNESS_STOPS[index] ?? FULLNESS_STOPS[0]
  const to = FULLNESS_STOPS[index + 1] ?? from
  const mix = (start: number, end: number) =>
    Math.round(start + (end - start) * local)
  return `rgb(${mix(from[0], to[0])} ${mix(from[1], to[1])} ${mix(from[2], to[2])})`
}

export function BlockChain({
  blocks,
  active,
  pending = null,
  updatedAt,
}: {
  blocks: Array<BlockSummary>
  active?: number
  pending?: number | null
  updatedAt: number
}) {
  const now = useNow(updatedAt)
  const chain = [...blocks].sort((a, b) => b.number - a.number)
  if (chain.length === 0 && pending === null) return null

  return (
    <div className="rounded-lg bg-background">
      <p className="px-3 pt-3 text-xs text-muted-foreground">
        Emptier is purple. Fuller is blue.
      </p>
      <div className="overflow-x-auto px-3 py-4">
        <div className="flex w-max items-end gap-3">
          {pending !== null ? <Waiting count={pending} /> : null}
          {pending !== null ? <NowMark /> : null}
          {chain.map((block) => (
            <Cube
              key={block.hash}
              block={block}
              now={now}
              active={block.number === active}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function Cube({
  block,
  now,
  active,
}: {
  block: BlockSummary
  now: number
  active: boolean
}) {
  const full =
    block.gasLimit > 0 ? Math.round((block.gasUsed / block.gasLimit) * 100) : 0
  const tone = fullnessTone(full)
  return (
    <Link
      to="/block/$blockId"
      params={{ blockId: String(block.number) }}
      aria-current={active ? 'page' : undefined}
      className="flex w-[132px] shrink-0 flex-col"
    >
      <span className="mb-2 text-center font-heading text-sm font-medium">
        {formatNumber(block.number)}
      </span>
      <span
        className="h-3 brightness-75"
        style={{
          background: tone,
          clipPath: 'polygon(8% 100%, 92% 100%, 100% 0, 0 0)',
        }}
      />
      <span
        className={cn(
          'mx-1.5 flex h-[138px] flex-col px-2.5 py-2 text-white',
          active && 'outline outline-2 outline-offset-2 outline-foreground',
        )}
        style={{ background: tone }}
      >
        <span className="text-[11px] opacity-80">
          {formatGwei(block.baseFeeGwei)} gwei
        </span>
        <span className="mt-2 font-heading text-xl font-medium leading-none">
          {formatNumber(block.txCount)}
        </span>
        <span className="text-[11px]">payments</span>
        <span className="mt-1 text-[11px] opacity-80">{full}% full</span>
        <span className="mt-auto text-[11px] opacity-80">
          {formatAge(now, block.timestamp)}
        </span>
      </span>
    </Link>
  )
}

function Waiting({ count }: { count: number }) {
  return (
    <div className="flex w-[132px] shrink-0 flex-col">
      <span className="mb-2 text-center font-heading text-sm font-medium">
        Waiting
      </span>
      <span
        className="h-3 bg-fee-low-bar brightness-75"
        style={{ clipPath: 'polygon(8% 100%, 92% 100%, 100% 0, 0 0)' }}
      />
      <span className="mx-1.5 flex h-[138px] flex-col bg-fee-low-bar px-2.5 py-2 text-white">
        <span className="text-[11px] opacity-80">Not in a block</span>
        <span className="mt-2 font-heading text-xl font-medium leading-none">
          {formatNumber(count)}
        </span>
        <span className="text-[11px]">payments</span>
      </span>
    </div>
  )
}

function NowMark() {
  return (
    <div className="flex h-[168px] flex-col items-center text-muted-foreground">
      <span aria-hidden="true">↑</span>
      <span className="my-1 w-px flex-1 border-l border-dashed border-current" />
      <span aria-hidden="true">↓</span>
    </div>
  )
}

function useNow(updatedAt: number): number {
  const [now, setNow] = useState(updatedAt)
  useEffect(() => {
    setNow(updatedAt)
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [updatedAt])
  return now
}
