import { Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import type { AddressResult } from '@/lib/chain'
import { getAddressView } from '@/lib/chain'
import { formatNumber } from '@/lib/format'
import type { Hop } from '@/lib/trace'
import type { MapLink, MapNode, TraceStep } from './address-graph'
import {
  MAP_H,
  MAP_W,
  TRACE_CAP,
  followPath,
  labelEth,
  mapGraph,
  packBubbles,
  spin,
} from './address-graph'
import { ErrorBanner, PageHeader, useTrackedAddresses } from './shell'

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

function BubbleStage({
  nodes,
  links,
  placed,
  busy,
  atCap,
  onBubble,
}: {
  nodes: Array<MapNode>
  links: Array<MapLink>
  placed: Map<string, { x: number; y: number; r: number }>
  busy: boolean
  atCap: boolean
  onBubble: (node: MapNode) => void
}) {
  const live = useRef(new Map<string, { x: number; y: number; r: number }>())
  const seen = useRef(false)
  const boxes = useRef(new Map<string, HTMLDivElement>())
  const lines = useRef(new Map<string, SVGLineElement>())
  const model = useRef({ nodes, links, placed })
  model.current = { nodes, links, placed }

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let frame = 0
    const tick = (time: number) => {
      const {
        nodes: currentNodes,
        links: currentLinks,
        placed: targets,
      } = model.current
      const keep = new Set(currentNodes.map((node) => node.id))
      for (const id of live.current.keys()) {
        if (!keep.has(id)) live.current.delete(id)
      }
      for (const node of currentNodes) {
        const target = targets.get(node.id)
        if (!target) continue
        let spot = live.current.get(node.id)
        if (!spot) {
          const anchor = anchorSpot(node.id, currentLinks, live.current)
          spot =
            seen.current && anchor && !reduce
              ? { x: anchor.x, y: anchor.y, r: 8 }
              : { x: target.x, y: target.y, r: target.r }
          live.current.set(node.id, spot)
        }
        const ease = reduce ? 1 : 0.09
        spot.x += (target.x - spot.x) * ease
        spot.y += (target.y - spot.y) * ease
        spot.r += (target.r - spot.r) * ease
        const drift = wobble(node.id, time, reduce)
        const box = boxes.current.get(node.id)
        if (!box) continue
        box.style.left = `${(((spot.x + drift.x) / MAP_W) * 100).toFixed(2)}%`
        box.style.top = `${(((spot.y + drift.y) / MAP_H) * 100).toFixed(2)}%`
        box.style.width = `${(((spot.r * 2) / MAP_W) * 100).toFixed(2)}%`
      }
      for (const link of currentLinks) {
        const from = live.current.get(link.a)
        const to = live.current.get(link.b)
        const line = lines.current.get(`${link.a}:${link.b}`)
        if (!from || !to || !line) continue
        const a = wobble(link.a, time, reduce)
        const b = wobble(link.b, time, reduce)
        line.setAttribute('x1', (from.x + a.x).toFixed(2))
        line.setAttribute('y1', (from.y + a.y).toFixed(2))
        line.setAttribute('x2', (to.x + b.x).toFixed(2))
        line.setAttribute('y2', (to.y + b.y).toFixed(2))
      }
      seen.current = true
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  const ordered = [...nodes].sort(
    (a, b) => (placed.get(b.id)?.r ?? 0) - (placed.get(a.id)?.r ?? 0),
  )

  return (
    <div className="relative aspect-[880/520] w-full overflow-hidden rounded-[10px] border bg-background">
      <svg
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        className="pointer-events-none absolute inset-0 h-full w-full"
      >
        {links.map((link) => {
          const from = placed.get(link.a)
          const to = placed.get(link.b)
          if (!from || !to) return null
          return (
            <line
              key={`${link.a}:${link.b}`}
              ref={(el) => {
                const key = `${link.a}:${link.b}`
                if (el) lines.current.set(key, el)
                else lines.current.delete(key)
              }}
              x1={from.x.toFixed(2)}
              y1={from.y.toFixed(2)}
              x2={to.x.toFixed(2)}
              y2={to.y.toFixed(2)}
              className="ether-line"
              style={{
                animationDirection:
                  link.direction === 'in' ? 'reverse' : 'normal',
              }}
              stroke={
                link.direction === 'out'
                  ? 'var(--flow-tip)'
                  : 'var(--flow-value)'
              }
              strokeWidth="2"
              strokeLinecap="round"
            />
          )
        })}
      </svg>
      {ordered.map((node) => {
        const spot = placed.get(node.id)
        if (!spot) return null
        const paint = bubblePaint(node)
        return (
          <div
            key={node.id}
            ref={(el) => {
              if (el) boxes.current.set(node.id, el)
              else boxes.current.delete(node.id)
            }}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${((spot.x / MAP_W) * 100).toFixed(2)}%`,
              top: `${((spot.y / MAP_H) * 100).toFixed(2)}%`,
              width: `${(((spot.r * 2) / MAP_W) * 100).toFixed(2)}%`,
              aspectRatio: '1',
              zIndex: Math.round(200 - spot.r),
            }}
          >
            <button
              type="button"
              disabled={busy || (!node.open && atCap)}
              onClick={() => onBubble(node)}
              aria-label={
                node.open
                  ? `Show ${tinyAddress(node.address)}`
                  : `Follow ${node.label} ETH ${node.direction === 'out' ? 'to' : 'from'} ${node.address}`
              }
              className="bubble-live flex size-full flex-col items-center justify-center overflow-hidden rounded-full border-2 text-center text-white disabled:cursor-default"
              style={{
                background: paint.background,
                borderColor: paint.border,
                boxShadow: paint.glow,
                animationDelay: `${(spin(node.id) % 12) * 40}ms, ${(spin(node.id) % 12) * 40 + 700}ms`,
              }}
            >
              {spot.r >= 36 ? (
                <>
                  <span className="max-w-full truncate px-1 font-mono text-[10px] leading-tight">
                    {tinyAddress(node.address)}
                  </span>
                  <span className="font-heading text-[11px] font-medium leading-tight">
                    {node.label}
                  </span>
                </>
              ) : null}
            </button>
          </div>
        )
      })}
    </div>
  )
}

function anchorSpot(
  id: string,
  links: Array<MapLink>,
  live: Map<string, { x: number; y: number; r: number }>,
) {
  for (const link of links) {
    const other = link.a === id ? link.b : link.b === id ? link.a : null
    if (!other) continue
    const spot = live.get(other)
    if (spot) return spot
  }
  return null
}

function wobble(id: string, time: number, reduce: boolean) {
  if (reduce) return { x: 0, y: 0 }
  const phase = spin(id) / 40
  return {
    x: Math.sin(time / 900 + phase) * 7,
    y: Math.cos(time / 1100 + phase) * 6,
  }
}

function bubblePaint(node: MapNode): {
  background: string
  border: string
  glow: string
} {
  const hue =
    node.direction === 'self'
      ? 152
      : node.direction === 'in'
        ? 168 + (hueShift(node.address) % 28)
        : 24 + (hueShift(node.address) % 24)
  return {
    background: `radial-gradient(circle at 32% 28%, hsl(${hue} 85% 62% / 0.95), hsl(${hue} 70% 38% / 0.92))`,
    border: `hsl(${hue} 90% 78%)`,
    glow: `0 0 22px hsl(${hue} 80% 48% / 0.45)`,
  }
}

function hueShift(address: string): number {
  let n = 0
  for (let i = 2; i < Math.min(address.length, 10); i++)
    n = (n * 33 + address.charCodeAt(i)) % 97
  return n
}

function tinyAddress(address: string): string {
  if (address.length <= 12) return address
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-xl font-medium">{value}</p>
    </div>
  )
}
