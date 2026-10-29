import type { Hop } from '@/lib/trace'

// shortcut: six wallets on this board, open a wallet's page to keep walking
export const TRACE_CAP = 6

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

export const MAP_W = 880
export const MAP_H = 520
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

export function spin(id: string): number {
  let n = 0
  for (let i = 0; i < id.length; i++) n = (n * 33 + id.charCodeAt(i)) % 997
  return n
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

export function labelEth(amountEth: string): string {
  const value = Number(amountEth)
  if (!Number.isFinite(value) || value === 0) return amountEth
  const digits = value >= 1 ? 2 : value >= 0.0001 ? 4 : 8
  const [whole, fraction = ''] = value.toFixed(digits).split('.')
  const trimmed = fraction.replace(/0+$/, '')
  const shown = trimmed ? `${whole}.${trimmed}` : whole
  return shown === '0' ? amountEth : shown
}
