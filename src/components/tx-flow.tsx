import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import type { CallView } from '@/lib/call'
import type { TxFlowResult } from '@/lib/chain'
import { formatAge, formatNumber, shortAddress } from '@/lib/format'
import { ErrorBanner, PageHeader } from './shell'
import { TokenMoves } from './tx-moves'
import { Split } from './tx-ribbons'

export { splitRibbons } from './tx-ribbons'

export function TxFlow({
  result,
  cached = null,
  onRefresh,
}: {
  result: TxFlowResult
  cached?: Extract<TxFlowResult, { ok: true }> | null
  onRefresh: () => void
}) {
  const data = result.ok ? result : cached
  const showsEther =
    !!data &&
    [data.valueEth, data.burnedEth, data.tipEth].some(
      (amount) => Number(amount) > 0,
    )
  const [now, setNow] = useState(result.updatedAt)
  useEffect(() => {
    setNow(result.updatedAt)
  }, [result.updatedAt])

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <PageHeader
        title="Transaction"
        subtitle={data ? shortAddress(data.hash) : 'Value and fee flow'}
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
          <p className="text-sm text-muted-foreground">
            {data.blockNumber === null ? 'Waiting to be included' : 'Confirmed'}
            {data.timestamp ? ` · ${formatAge(now, data.timestamp)}` : ''}
            {data.blockNumber !== null ? (
              <>
                {' · '}
                <Link
                  to="/block/$blockId"
                  params={{ blockId: String(data.blockNumber) }}
                  className="text-foreground underline-offset-2 hover:underline"
                >
                  {`Block ${formatNumber(data.blockNumber)}`}
                </Link>
              </>
            ) : null}
          </p>
          {data.call.kind === 'transfer' ? null : (
            <Execution
              call={data.call}
              succeeded={data.succeeded}
              from={data.from}
              to={data.to}
              toName={data.toName}
            />
          )}
          <TokenMoves tokens={data.tokens} more={data.tokenMore} />
          {showsEther ? (
            <p className="text-sm text-muted-foreground">
              Ether leaves the sender. A thicker line is more ether.
            </p>
          ) : data.call.kind === 'transfer' && data.tokens.length === 0 ? (
            <p className="text-sm text-muted-foreground">No ether moved.</p>
          ) : null}
          {showsEther ? (
            <Split
              from={data.from}
              to={data.to}
              toName={data.toName}
              totalEth={data.totalEth}
              valueEth={data.valueEth}
              burnedEth={data.burnedEth}
              tipEth={data.tipEth}
            />
          ) : null}
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Gas used" value={formatNumber(data.gasUsed)} />
            <Stat label="Price paid" value={`${data.effectiveGwei} gwei`} />
            <Stat
              label="Highest price allowed"
              value={`${data.maxGwei} gwei`}
            />
            <Stat label="Fee in ETH" value={`${data.feeEth} ETH`} />
          </section>
          <p className="text-xs text-muted-foreground break-all">{data.hash}</p>
        </>
      ) : null}
    </div>
  )
}

function Execution({
  call,
  succeeded,
  from,
  to,
  toName,
}: {
  call: Exclude<CallView, { kind: 'transfer' }>
  succeeded: boolean | null
  from: string
  to: string | null
  toName: string | null
}) {
  return (
    <section className="rounded-[10px] border bg-card p-4">
      {succeeded === null ? null : (
        <p className="text-sm font-medium">
          {succeeded ? 'This ran.' : 'This did not go through.'}
        </p>
      )}
      <p className="mt-1 text-sm text-muted-foreground">
        {call.kind === 'create' ? (
          'A new program was created.'
        ) : (
          <>
            <Link
              to="/address/$address"
              params={{ address: from }}
              className="text-foreground underline-offset-2 hover:underline"
            >
              {shortAddress(from)}
            </Link>
            {' asked '}
            {to ? (
              <Link
                to="/address/$address"
                params={{ address: to }}
                className="text-foreground underline-offset-2 hover:underline"
              >
                {toName ?? shortAddress(to)}
              </Link>
            ) : (
              'a program'
            )}
            {` to ${call.name}.`}
          </>
        )}
      </p>
      {call.kind === 'call' && !call.known ? (
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          {call.selector}
        </p>
      ) : null}
    </section>
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
