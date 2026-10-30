import { Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { getAddressView } from '@/lib/chain'
import { shortAddress } from '@/lib/format'
import type { Hop } from '@/lib/trace'
import type { FlowRibbon, TraceStep } from './address-graph'
import {
  TRACE_CAP,
  followPath,
  labelEth,
  ribbonHeights,
  walletRibbons,
} from './address-graph'
import { ErrorBanner } from './shell'

export function TransferSection({
  address = '',
  historyMessage,
  transfers,
  onRetry,
  kind = 'Wallet',
  balance = '',
}: {
  address?: string
  historyMessage: string | null
  transfers: Array<Hop>
  onRetry: () => void
  kind?: string
  balance?: string
}) {
  if (historyMessage) {
    return <ErrorBanner message={historyMessage} onRetry={onRetry} />
  }
  return (
    <MoneyFlow
      address={address}
      transfers={transfers}
      kind={kind}
      balance={balance}
    />
  )
}

function MoneyFlow({
  address,
  transfers,
  kind,
  balance,
}: {
  address: string
  transfers: Array<Hop>
  kind: string
  balance: string
}) {
  const [path, setPath] = useState<Array<TraceStep>>(() => [
    {
      address,
      kind,
      balance,
      hops: transfers,
      historyMessage: null,
      via: null,
    },
  ])
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const ticket = useRef(0)
  const pending = useRef<Hop | null>(null)

  useEffect(() => {
    setPath((prev) => {
      const root: TraceStep = {
        address,
        kind,
        balance,
        hops: transfers,
        historyMessage: null,
        via: null,
      }
      if (prev[0]?.address !== address) return [root]
      return [root, ...prev.slice(1)]
    })
  }, [address, kind, balance, transfers])

  if (transfers.length === 0 && path.length === 1) {
    return (
      <p className="text-sm text-muted-foreground">
        No ether moved in the recent payments.
      </p>
    )
  }

  const last = path[path.length - 1]
  const columns = walletRibbons(last?.hops ?? [])
  const incoming = paint(columns.incoming)
  const outgoing = paint(columns.outgoing)
  const atCap = path.length >= TRACE_CAP
  const opened = new Set(path.map((step) => step.address))

  function focus(index: number) {
    ticket.current += 1
    setBusy(false)
    setProblem(null)
    setPath((prev) => prev.slice(0, index + 1))
  }

  function choose(hop: Hop) {
    const existing = path.findIndex((step) => step.address === hop.counterparty)
    if (existing >= 0) {
      focus(existing)
      return
    }
    if (path.length >= TRACE_CAP) return
    pending.current = hop
    void load(hop)
  }

  async function load(hop: Hop) {
    const id = ++ticket.current
    setBusy(true)
    setProblem(null)
    try {
      const result = await getAddressView({ data: hop.counterparty })
      if (id !== ticket.current) return
      if (!result.ok) {
        setProblem(result.message)
        return
      }
      setPath((prev) =>
        followPath(prev, {
          address: result.address,
          kind: result.contract ? 'Program' : 'Wallet',
          balance: `${result.balanceEth} ETH`,
          hops: result.transfers,
          historyMessage: result.historyMessage,
          via: {
            amountEth: hop.amountEth,
            hash: hop.hash,
            direction: hop.direction,
          },
        }),
      )
    } catch {
      if (id === ticket.current) setProblem('Could not reach Ethereum')
    } finally {
      if (id === ticket.current) setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Thicker bar, more ether. Left is money in, right is money out. Click a
        bar to open that wallet.
      </p>
      {path.length > 1 ? (
        <ol className="flex flex-wrap items-center gap-1.5 text-xs">
          {path.map((step, index) => (
            <li key={step.address} className="flex items-center gap-1.5">
              {index > 0 ? (
                <span className="text-muted-foreground">/</span>
              ) : null}
              <button
                type="button"
                onClick={() => focus(index)}
                disabled={index === path.length - 1}
                className="font-mono text-foreground underline-offset-2 hover:underline disabled:text-muted-foreground disabled:no-underline"
              >
                {shortAddress(step.address)}
              </button>
            </li>
          ))}
        </ol>
      ) : null}
      {busy ? <p className="text-sm text-muted-foreground">Reading…</p> : null}
      {problem ? (
        <ErrorBanner
          message={problem}
          onRetry={() => {
            const hop = pending.current
            if (hop) void load(hop)
          }}
        />
      ) : null}
      {last?.historyMessage ? (
        <ErrorBanner message={last.historyMessage} onRetry={onRetryLast} />
      ) : null}
      <div className="grid items-start gap-4 rounded-[10px] border bg-card p-4 md:grid-cols-[minmax(0,1fr)_220px_minmax(0,1fr)]">
        <RibbonColumn
          title="Money in"
          empty="No ether in."
          ribbons={incoming}
          busy={busy}
          atCap={atCap}
          opened={opened}
          onOpen={choose}
        />
        {last ? (
          <div className="rounded-[10px] border bg-background px-4 py-5 text-center md:mt-6">
            <p className="text-xs text-muted-foreground">{last.kind}</p>
            <p className="mt-1 font-mono text-xs break-all">
              {shortAddress(last.address)}
            </p>
            <p className="mt-2 font-heading text-lg">{last.balance}</p>
            {path.length > 1 ? (
              <Link
                to="/address/$address"
                params={{ address: last.address }}
                className="mt-2 inline-block text-xs underline-offset-2 hover:underline"
              >
                Open this wallet
              </Link>
            ) : null}
          </div>
        ) : null}
        <RibbonColumn
          title="Money out"
          empty="No ether out."
          ribbons={outgoing}
          busy={busy}
          atCap={atCap}
          opened={opened}
          onOpen={choose}
        />
      </div>
      {last?.via ? (
        <p className="text-xs text-muted-foreground">
          {last.via.direction === 'out' ? 'Sent' : 'Received'}{' '}
          {labelEth(last.via.amountEth)} ETH
          {' · '}
          <Link
            to="/tx/$hash"
            params={{ hash: last.via.hash }}
            className="underline-offset-2 hover:underline"
          >
            payment
          </Link>
        </p>
      ) : null}
      {atCap ? (
        <p className="text-xs text-muted-foreground">
          This board holds {TRACE_CAP} opened wallets. Open one to keep going.
        </p>
      ) : null}
    </div>
  )

  function onRetryLast() {
    const hop = last?.via
    if (!hop || !last) return
    void load({
      hash: hop.hash,
      direction: hop.direction,
      counterparty: last.address,
      amountEth: hop.amountEth,
      addressTo: `/address/${last.address}`,
      txTo: `/tx/${hop.hash}`,
    })
  }
}

function paint(ribbons: Array<FlowRibbon>) {
  const heights = ribbonHeights(ribbons.map((ribbon) => ribbon.amount))
  return ribbons.map((ribbon, index) => ({
    ...ribbon,
    h: heights[index] ?? 6,
  }))
}

function RibbonColumn({
  title,
  empty,
  ribbons,
  busy,
  atCap,
  opened,
  onOpen,
}: {
  title: string
  empty: string
  ribbons: Array<FlowRibbon & { h: number }>
  busy: boolean
  atCap: boolean
  opened: Set<string>
  onOpen: (hop: Hop) => void
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-muted-foreground">{title}</p>
      {ribbons.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {ribbons.map((ribbon) => {
            const known = opened.has(ribbon.address)
            const disabled = busy || (atCap && !known)
            return (
              <li key={`${ribbon.direction}:${ribbon.address}`}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    onOpen({
                      hash: ribbon.hash,
                      direction: ribbon.direction,
                      counterparty: ribbon.address,
                      amountEth: ribbon.label,
                      addressTo: `/address/${ribbon.address}`,
                      txTo: `/tx/${ribbon.hash}`,
                    })
                  }
                  aria-label={`${ribbon.direction === 'in' ? 'Received' : 'Sent'} ${ribbon.label} ETH ${ribbon.direction === 'in' ? 'from' : 'to'} ${ribbon.address}`}
                  className="flex w-full flex-col gap-1.5 rounded-lg px-2 py-2 text-left hover:bg-muted/60 disabled:cursor-default disabled:opacity-50"
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate font-mono text-xs">
                      {shortAddress(ribbon.address)}
                    </span>
                    <span className="shrink-0 font-heading text-sm">
                      {ribbon.label} ETH
                    </span>
                  </span>
                  <Bar h={ribbon.h} direction={ribbon.direction} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function Bar({ h, direction }: { h: number; direction: 'in' | 'out' }) {
  return (
    <span
      aria-hidden
      className="block w-full rounded-full"
      style={{
        height: h,
        background:
          direction === 'in' ? 'var(--flow-value)' : 'var(--flow-tip)',
      }}
    />
  )
}
