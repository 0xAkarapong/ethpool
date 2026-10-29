import { useEffect, useRef } from 'react'
import type { MapLink, MapNode } from './address-graph'
import { MAP_H, MAP_W, spin } from './address-graph'

export function BubbleStage({
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
