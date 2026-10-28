import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import type { TxFlowResult } from '@/lib/chain'
import { formatAge, formatNumber, shortAddress } from '@/lib/format'
import { ErrorBanner, PageHeader } from './shell'

export function TxFlow({
  result,
  onRefresh,
}: {
  result: TxFlowResult
  onRefresh: () => void
}) {
  const [now, setNow] = useState(result.updatedAt)
  useEffect(() => {
    setNow(result.updatedAt)
  }, [result.updatedAt])

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <PageHeader
        title="Transaction"
        subtitle={result.ok ? shortAddress(result.hash) : 'Value and fee flow'}
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
        <>
          <p className="text-sm text-muted-foreground">
            {result.blockNumber === null ? 'PENDING' : 'IN BLOCK'}
            {result.timestamp
              ? ` · ${formatAge(now, result.timestamp)}`
              : ''} · {result.kind}
            {result.blockNumber !== null ? (
              <>
                {' · '}
                <Link
                  to="/block/$blockId"
                  params={{ blockId: String(result.blockNumber) }}
                  className="text-foreground underline-offset-2 hover:underline"
                >{`#${formatNumber(result.blockNumber)}`}</Link>
              </>
            ) : null}
          </p>
          <div className="relative rounded-[10px] border bg-card p-4 lg:p-6">
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-6 hidden lg:block"
              aria-hidden
            >
              <FlowPath
                d="M28 50 C46 50 54 16 72 16"
                stroke="var(--flow-value)"
              />
              <FlowPath
                d="M28 50 C46 50 54 50 72 50"
                stroke="var(--flow-burn)"
              />
              <FlowPath
                d="M28 50 C46 50 54 84 72 84"
                stroke="var(--flow-tip)"
              />
            </svg>
            <div className="relative grid gap-3 lg:grid-cols-[300px_1fr_300px] lg:items-center">
              <Party
                role="From"
                title={shortAddress(result.from)}
                kind="Sender"
                amount={`${result.totalEth} ETH`}
                tone="bg-foreground"
              />
              <div className="hidden lg:block" />
              <div className="flex flex-col gap-3">
                <Party
                  role="To"
                  title={
                    result.to
                      ? (result.toName ?? shortAddress(result.to))
                      : 'Contract creation'
                  }
                  kind="Value"
                  amount={`${result.valueEth} ETH`}
                  tone="bg-flow-value"
                />
                <Party
                  role="Burned"
                  title="Base fee"
                  kind="Destroyed"
                  amount={`${result.burnedEth} ETH`}
                  tone="bg-flow-burn"
                />
                <Party
                  role="Tip"
                  title="Priority fee"
                  kind="To validator"
                  amount={`${result.tipEth} ETH`}
                  tone="bg-flow-tip"
                />
              </div>
            </div>
          </div>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Gas used" value={formatNumber(result.gasUsed)} />
            <Stat label="Effective" value={`${result.effectiveGwei} gwei`} />
            <Stat label="Max fee" value={`${result.maxGwei} gwei`} />
            <Stat label="Fee paid" value={`${result.feeEth} ETH`} />
          </section>
          <p className="text-xs text-muted-foreground break-all">
            {result.hash}
          </p>
        </>
      ) : null}
    </div>
  )
}

function FlowPath({ d, stroke }: { d: string; stroke: string }) {
  return (
    <path
      d={d}
      fill="none"
      stroke={stroke}
      strokeWidth="2"
      vectorEffect="non-scaling-stroke"
    />
  )
}

function Party({
  role,
  title,
  kind,
  amount,
  tone,
}: {
  role: string
  title: string
  kind: string
  amount: string
  tone: string
}) {
  return (
    <div className="flex overflow-hidden rounded-[10px] border bg-card">
      <div className={`w-1 shrink-0 ${tone}`} />
      <div className="min-w-0 px-4 py-3">
        <p className="text-xs text-muted-foreground">{role}</p>
        <p className="truncate font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{kind}</p>
        <p className="mt-1 font-heading text-lg font-medium">{amount}</p>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-xl font-medium">{value}</p>
    </div>
  )
}
