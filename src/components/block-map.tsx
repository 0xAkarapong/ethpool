import { Link, useParams } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import type { BlockResult } from '@/lib/chain'
import { feeHeat, formatGwei, formatNumber, formatUtcTime } from '@/lib/format'
import { treemap } from '@/lib/treemap'
import { BlockChain } from './block-chain'
import { BlockMosaic } from './block-mosaic'
import { HighestFees, PaymentDetail } from './block-payment'
import { readTile, resolvePicked, writeTile } from './block-pick'
import { ErrorBanner, PageHeader } from './shell'

const MAP = 788

export { resolvePicked } from './block-pick'

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
  const blockNumber = data?.block.number ?? null
  const previousBlock = useRef<number | null>(null)
  const switching =
    blockNumber !== null &&
    previousBlock.current !== null &&
    previousBlock.current !== blockNumber
  const [picked, setPicked] = useState<string | null>(null)
  useEffect(() => {
    previousBlock.current = blockNumber
  }, [blockNumber])
  useEffect(() => {
    if (blockNumber === null) return
    setPicked(readTile(blockNumber))
  }, [blockNumber])
  const txs = data ? data.txs : []
  const selected = resolvePicked(picked, txs)
  function openTile(hash: string) {
    if (blockNumber === null) return
    writeTile(blockNumber, hash)
    setPicked(hash)
  }
  const cells = treemap(
    txs.map((tx) => ({ ...tx, value: Math.max(tx.gas, 1) })),
    MAP,
    MAP,
    data ? data.block.gasLimit : undefined,
  )
  const fees = txs.map((tx) => tx.feeGwei)
  const tone = feeHeat(fees)
  const params = useParams<{ blockId?: string }>({ strict: false })
  const atTip = !params.blockId || params.blockId === 'latest'

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <PageHeader
        title={data ? `Block ${formatNumber(data.block.number)}` : 'Block'}
        subtitle={
          data
            ? `Included ${formatUtcTime(data.block.timestamp * 1000)}. Each tile is one payment. Bigger means more gas. Blank space is room this block left unused.`
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
              <BlockMosaic
                cells={cells}
                selectedHash={selected?.hash ?? null}
                tone={tone}
                blockNumber={blockNumber}
                switching={switching}
                onPick={openTile}
              />
            </div>
            <div className="flex flex-col gap-4">
              {selected ? (
                <PaymentDetail
                  tx={selected}
                  baseFee={data.block.baseFeeGwei}
                  tone={tone}
                />
              ) : null}
              <HighestFees
                txs={txs}
                tone={tone}
                picked={selected?.hash ?? null}
                onPick={openTile}
              />
            </div>
          </div>
        </>
      ) : null}
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
