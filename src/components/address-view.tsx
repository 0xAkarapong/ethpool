import { Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { getAddressView, type AddressResult } from '@/lib/chain'
import { formatNumber } from '@/lib/format'
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
              label="Transactions sent"
              value={formatNumber(result.txCount)}
            />
            <Stat
              label="What this is"
              value={result.contract ? 'Program' : 'Wallet'}
            />
          </section>
          <TransferSection
            address={result.address}
            historyMessage={result.historyMessage}
            transfers={result.transfers}
            onRetry={onRefresh}
            kind={result.contract ? 'Program' : 'Wallet'}
            balance={`${result.balanceEth} ETH`}
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

// shortcut: six wallets on this board, open a wallet's page to keep walking
const TRACE_CAP = 6

export type TraceStep = {
  address: string
  kind: string
  balance: string
  hops: Array<Hop>
  historyMessage: string | null
  via: {
    amountEth: string
    hash: string
    direction: Hop['direction']
  } | null
}

export function followPath(
  path: Array<TraceStep>,
  next: TraceStep,
): Array<TraceStep> {
  const existing = path.findIndex((step) => step.address === next.address)
  if (existing >= 0) return path.slice(0, existing + 1)
  if (path.length >= TRACE_CAP) return path
  return [...path, next]
}

const MAP_W = 880
const MAP_H = 520
// shortcut: twelve biggest counterparties per opened wallet, page the rest when a trace needs them
const BUBBLES_PER_WALLET = 12

export type MapNode = {
  id: string
  address: string
  r: number
  amount: number
  amountEth: string
  label: string
  hash: string | null
  direction: 'in' | 'out' | 'self'
  open: boolean
}

export type MapLink = { a: string; b: string; direction: 'in' | 'out' }

/** Six decades of ether fit on the map. A straight area scale hides every payment next to a large balance. */
export function bubbleRadius(value: number, max: number): number {
  if (!(value > 0) || !(max > 0)) return 22
  const decades = Math.log10(value) - Math.log10(max)
  const t = Math.min(1, Math.max(0, (decades + 6) / 6))
  return Math.round(22 + t * 70)
}

export function mapGraph(path: Array<TraceStep>): {
  nodes: Array<MapNode>
  links: Array<MapLink>
} {
  const open = new Set(path.map((step) => step.address))
  const drafts = new Map<string, Omit<MapNode, 'id' | 'r' | 'label'>>()
  const links: Array<MapLink> = []
  const seen = new Set<string>()

  function touch(
    address: string,
    amount: number,
    amountEth: string,
    hash: string | null,
    direction: MapNode['direction'],
    isOpen: boolean,
  ) {
    const current = drafts.get(address)
    if (!current) {
      drafts.set(address, {
        address,
        amount,
        amountEth,
        hash,
        direction: isOpen ? 'self' : direction,
        open: isOpen,
      })
      return
    }
    if (amount >= current.amount) {
      current.amount = amount
      current.amountEth = amountEth
      current.hash = hash
      if (!isOpen && !current.open) current.direction = direction
    }
    if (isOpen) {
      current.open = true
      current.direction = 'self'
      current.amount = Math.max(current.amount, amount)
    }
  }

  function link(a: string, b: string, direction: 'in' | 'out') {
    if (a === b) return
    const key = a < b ? `${a}|${b}` : `${b}|${a}`
    if (seen.has(key)) return
    seen.add(key)
    links.push({ a, b, direction })
  }

  for (const step of path) {
    const groups = groupHops(step.hops).slice(0, BUBBLES_PER_WALLET)
    const flow = groups.reduce((sum, group) => sum + group.amount, 0)
    touch(
      step.address,
      Math.max(ethNumber(step.balance), flow),
      step.balance || labelEth(flow),
      step.via?.hash ?? null,
      'self',
      true,
    )
    for (const group of groups) {
      if (!open.has(group.address)) {
        touch(
          group.address,
          group.amount,
          group.amountEth,
          group.hash,
          group.direction,
          false,
        )
      }
      link(step.address, group.address, group.direction)
    }
  }
  for (let index = 1; index < path.length; index++) {
    const via = path[index]?.via
    const previous = path[index - 1]
    const step = path[index]
    if (via && previous && step)
      link(previous.address, step.address, via.direction)
  }

  const max = Math.max(0, ...[...drafts.values()].map((node) => node.amount))
  const root = path[0]?.address
  const nodes = [...drafts.values()]
    .map((node) => ({
      ...node,
      id: node.address,
      label: node.open ? node.amountEth : labelEth(node.amount),
      r: node.open
        ? Math.max(46, bubbleRadius(node.amount, max))
        : bubbleRadius(node.amount, max),
    }))
    .sort((a, b) => {
      if (a.address === root) return -1
      if (b.address === root) return 1
      return b.amount - a.amount
    })
  const visible = new Set(nodes.map((node) => node.id))
  return {
    nodes,
    links: links.filter((item) => visible.has(item.a) && visible.has(item.b)),
  }
}

export function packBubbles(
  items: Array<Pick<MapNode, 'id' | 'r'>>,
  links: Array<Pick<MapLink, 'a' | 'b'>>,
  width = MAP_W,
  height = MAP_H,
): Array<{ id: string; x: number; y: number; r: number }> {
  const cx = width / 2
  const cy = height / 2
  const placed = items.map((node, index) => {
    const orbit =
      index === 0 ? 0 : (items[0]?.r ?? 40) + 70 + (spin(node.id) % 50)
    const turn = spin(node.id) / 97
    const angle =
      items.length <= 1
        ? 0
        : ((index - 1 + turn) / (items.length - 1)) * Math.PI * 2
    return {
      id: node.id,
      r: node.r,
      x: cx + Math.cos(angle) * orbit,
      y: cy + Math.sin(angle) * orbit,
    }
  })
  const indexOf = new Map(placed.map((node, index) => [node.id, index]))
  for (let step = 0; step < 90; step++) {
    for (const link of links) {
      const a = placed[indexOf.get(link.a) ?? -1]
      const b = placed[indexOf.get(link.b) ?? -1]
      if (!a || !b) continue
      const dx = b.x - a.x
      const dy = b.y - a.y
      const dist = Math.hypot(dx, dy) || 0.01
      const pull = (dist - (a.r + b.r + 36)) * 0.06
      a.x += (dx / dist) * pull
      a.y += (dy / dist) * pull
      b.x -= (dx / dist) * pull
      b.y -= (dy / dist) * pull
    }
    separate(placed)
    for (const node of placed) {
      node.x += (cx - node.x) * 0.015
      node.y += (cy - node.y) * 0.015
      const pad = node.r + 6
      node.x = Math.min(width - pad, Math.max(pad, node.x))
      node.y = Math.min(height - pad, Math.max(pad, node.y))
    }
    separate(placed)
  }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const node of placed) {
    minX = Math.min(minX, node.x - node.r)
    minY = Math.min(minY, node.y - node.r)
    maxX = Math.max(maxX, node.x + node.r)
    maxY = Math.max(maxY, node.y + node.r)
  }
  const scale = Math.min(
    1,
    (width - 24) / Math.max(1, maxX - minX),
    (height - 24) / Math.max(1, maxY - minY),
  )
  const midX = (minX + maxX) / 2
  const midY = (minY + maxY) / 2
  return placed.map((node) => ({
    id: node.id,
    x: Math.round((width / 2 + (node.x - midX) * scale) * 100) / 100,
    y: Math.round((height / 2 + (node.y - midY) * scale) * 100) / 100,
    r: Math.round(node.r * scale),
  }))
}

function spin(id: string): number {
  let n = 0
  for (let i = 0; i < id.length; i++) n = (n * 33 + id.charCodeAt(i)) % 997
  return n
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

function groupHops(hops: Array<Hop>) {
  const groups = new Map<
    string,
    {
      address: string
      amount: number
      amountEth: string
      hash: string
      direction: 'in' | 'out'
      biggest: number
    }
  >()
  for (const hop of hops) {
    const value = Number(hop.amountEth)
    const amount = Number.isFinite(value) ? value : 0
    const current = groups.get(hop.counterparty)
    if (!current) {
      groups.set(hop.counterparty, {
        address: hop.counterparty,
        amount,
        amountEth: hop.amountEth,
        hash: hop.hash,
        direction: hop.direction,
        biggest: amount,
      })
      continue
    }
    current.amount += amount
    if (amount >= current.biggest) {
      current.biggest = amount
      current.hash = hop.hash
      current.direction = hop.direction
      current.amountEth = hop.amountEth
    }
  }
  return [...groups.values()].sort((a, b) => b.amount - a.amount)
}

function separate(placed: Array<{ x: number; y: number; r: number }>) {
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i]
      const b = placed[j]
      if (!a || !b) continue
      let dx = b.x - a.x
      let dy = b.y - a.y
      let dist = Math.hypot(dx, dy)
      const min = a.r + b.r + 12
      if (dist >= min) continue
      if (dist < 0.01) {
        dx = 1
        dy = 0
        dist = 1
      }
      const push = (min - dist) / 2
      a.x -= (dx / dist) * push
      a.y -= (dy / dist) * push
      b.x += (dx / dist) * push
      b.y += (dy / dist) * push
    }
  }
}

function ethNumber(text: string): number {
  const value = Number(text.replace(/[^0-9.]/g, ''))
  return Number.isFinite(value) ? value : 0
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

function labelEth(amountEth: string): string {
  const value = Number(amountEth)
  if (!Number.isFinite(value) || value === 0) return amountEth
  const digits = value >= 1 ? 2 : value >= 0.0001 ? 4 : 8
  const [whole, fraction = ''] = value.toFixed(digits).split('.')
  const trimmed = fraction.replace(/0+$/, '')
  const shown = trimmed ? `${whole}.${trimmed}` : whole
  return shown === '0' ? amountEth : shown
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-xl font-medium">{value}</p>
    </div>
  )
}
