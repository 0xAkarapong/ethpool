import { Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { getAddressView } from '@/lib/chain'
import type { Hop } from '@/lib/trace'
import type { MapNode, TraceStep } from './address-graph'
import {
  TRACE_CAP,
  followPath,
  labelEth,
  mapGraph,
  packBubbles,
} from './address-graph'
import { BubbleStage } from './address-stage'
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

  function focus(index: number) {
    ticket.current += 1
    setBusy(false)
    setProblem(null)
    setPath((prev) => prev.slice(0, index + 1))
  }

  function onBubble(node: MapNode) {
    if (node.open) {
      const index = path.findIndex((step) => step.address === node.address)
      if (index >= 0) focus(index)
      return
    }
    if (!node.hash || node.direction === 'self') return
    choose({
      hash: node.hash,
      direction: node.direction,
      counterparty: node.address,
      amountEth: node.amountEth,
      addressTo: `/address/${node.address}`,
      txTo: `/tx/${node.hash}`,
    })
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

  const graph = mapGraph(path)
  const placed = new Map(
    packBubbles(graph.nodes, graph.links).map((node) => [node.id, node]),
  )
  const atCap = path.length >= TRACE_CAP

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Bigger bubble, more ether. A line means ether moved between those
        wallets. Click a bubble to open the next wallets.
      </p>
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
      {last.historyMessage ? (
        <ErrorBanner message={last.historyMessage} onRetry={onRetryLast} />
      ) : null}
      {graph.nodes.length > 0 ? (
        <BubbleStage
          nodes={graph.nodes}
          links={graph.links}
          placed={placed}
          busy={busy}
          atCap={atCap}
          onBubble={onBubble}
        />
      ) : null}
      {last.via ? (
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
          This map holds {TRACE_CAP} opened wallets. Open one to keep going.
        </p>
      ) : null}
    </div>
  )

  function onRetryLast() {
    const hop = last.via
    if (!hop) return
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
