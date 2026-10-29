import { Link } from '@tanstack/react-router'
import type { AddressResult } from '@/lib/chain'
import { formatNumber } from '@/lib/format'
import { TransferSection } from './address-flow'
import { ErrorBanner, PageHeader, useTrackedAddresses } from './shell'

export { TransferSection }

export function AddressView({
  address,
  result,
  cached = null,
  onRefresh,
}: {
  address: string
  result: AddressResult
  cached?: Extract<AddressResult, { ok: true }> | null
  onRefresh: () => void
}) {
  const data = result.ok ? result : cached
  const shown = data ? data.address : address
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <PageHeader
        title="Address"
        subtitle={
          data
            ? data.contract
              ? 'A program that holds money'
              : 'A wallet a person controls'
            : 'Balance and recent payments'
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-xs break-all text-muted-foreground">
          {shown}
        </p>
        {data ? <TrackButton address={data.address} /> : null}
      </div>
      {result.ok ? null : (
        <ErrorBanner message={result.message} onRetry={onRefresh} />
      )}
      {data ? (
        <>
          <section className="grid gap-4 sm:grid-cols-3">
            <Stat label="Balance" value={`${data.balanceEth} ETH`} />
            <Stat
              label="Transactions sent"
              value={formatNumber(data.txCount)}
            />
            <Stat
              label="What this is"
              value={data.contract ? 'Program' : 'Wallet'}
            />
          </section>
          <TransferSection
            address={data.address}
            historyMessage={data.historyMessage}
            transfers={data.transfers}
            onRetry={onRefresh}
            kind={data.contract ? 'Program' : 'Wallet'}
            balance={`${data.balanceEth} ETH`}
          />
        </>
      ) : null}
    </div>
  )
}

export function AddressList() {
  const { tracked, untrack } = useTrackedAddresses()
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div>
        <h1 className="font-heading text-[28px] font-medium leading-none">
          Addresses
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Addresses tracked in this browser.
        </p>
      </div>
      {tracked.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No tracked addresses. Search one to follow its transfers.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tracked.map((address) => (
            <li
              key={address}
              className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border bg-card px-4 py-3"
            >
              <Link
                to="/address/$address"
                params={{ address }}
                className="font-mono text-sm break-all"
              >
                {address}
              </Link>
              <button
                type="button"
                onClick={() => untrack(address)}
                className="rounded-lg border bg-card px-3 py-2 text-sm font-medium"
              >
                Stop tracking
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function TrackButton({ address }: { address: string }) {
  const { tracked, track, untrack } = useTrackedAddresses()
  const on = tracked.includes(address)
  return (
    <button
      type="button"
      onClick={() => (on ? untrack(address) : track(address))}
      className="rounded-lg border bg-card px-3 py-2 text-sm font-medium"
    >
      {on ? 'Stop tracking' : 'Track address'}
    </button>
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
