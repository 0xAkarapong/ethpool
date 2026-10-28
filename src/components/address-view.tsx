import { Link } from '@tanstack/react-router'
import type { AddressResult } from '@/lib/chain'
import { formatNumber, shortAddress } from '@/lib/format'
import type { Hop } from '@/lib/trace'
import { ErrorBanner, PageHeader, useTrackedAddresses } from './shell'

export function AddressView({
  address,
  result,
  onRefresh,
}: {
  address: string
  result: AddressResult
  onRefresh: () => void
}) {
  const shown = result.ok ? result.address : address
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <PageHeader
        title="Address"
        subtitle={
          result.ok
            ? result.contract
              ? 'Contract'
              : 'Externally owned account'
            : 'Balance and recent transfers'
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
        {result.ok ? <TrackButton address={result.address} /> : null}
      </div>
      {result.ok ? null : (
        <ErrorBanner message={result.message} onRetry={onRefresh} />
      )}
      {result.ok ? (
        <>
          <section className="grid gap-4 sm:grid-cols-3">
            <Stat label="Balance" value={`${result.balanceEth} ETH`} />
            <Stat
              label="Transaction count"
              value={formatNumber(result.txCount)}
            />
            <Stat
              label="Account"
              value={result.contract ? 'Contract' : 'Externally owned'}
            />
          </section>
          <TransferSection
            historyMessage={result.historyMessage}
            transfers={result.transfers}
            onRetry={onRefresh}
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

export function TransferSection({
  historyMessage,
  transfers,
  onRetry,
}: {
  historyMessage: string | null
  transfers: Array<Hop>
  onRetry: () => void
}) {
  if (historyMessage) {
    return <ErrorBanner message={historyMessage} onRetry={onRetry} />
  }
  return <TransferTable transfers={transfers} />
}

function TransferTable({ transfers }: { transfers: Array<Hop> }) {
  if (transfers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No ETH transfers in the recent window.
      </p>
    )
  }
  return (
    <div className="overflow-x-auto rounded-[10px] border bg-card">
      <table className="w-full text-left text-sm">
        <thead className="text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Direction</th>
            <th className="px-4 py-3 font-medium">Counterparty</th>
            <th className="px-4 py-3 font-medium">Amount</th>
            <th className="px-4 py-3 font-medium">Transaction</th>
          </tr>
        </thead>
        <tbody>
          {transfers.map((hop) => (
            <tr
              key={`${hop.hash}:${hop.direction}:${hop.counterparty}`}
              className="border-t"
            >
              <td className="px-4 py-3">
                {hop.direction === 'in' ? 'In' : 'Out'}
              </td>
              <td className="px-4 py-3">
                <Link
                  to="/address/$address"
                  params={{ address: hop.counterparty }}
                  className="font-mono underline-offset-2 hover:underline"
                >
                  {shortAddress(hop.counterparty)}
                </Link>
              </td>
              <td className="px-4 py-3 font-mono">{hop.amountEth} ETH</td>
              <td className="px-4 py-3">
                <Link
                  to="/tx/$hash"
                  params={{ hash: hop.hash }}
                  className="font-mono underline-offset-2 hover:underline"
                >
                  {shortAddress(hop.hash)}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
