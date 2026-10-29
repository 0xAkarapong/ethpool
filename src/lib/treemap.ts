export type TreemapRect = { x: number; y: number; w: number; h: number }

const GRID = 144
// Repeated sizes, so the field has a rhythm instead of a pile of one-off rectangles.
const STEPS = [1, 2, 3, 4, 5, 7, 9, 12, 16, 21, 28, 36, 48, 64, 84, 112]

type Placed = { x: number; y: number; s: number }

const FOCUS_X = GRID * 0.5
const FOCUS_Y = GRID * 0.5

function snap(side: number): number {
  const capped = Math.min(side, GRID - 2)
  if (capped <= 1) return 1
  let best = 1
  let bestDist = Infinity
  for (const step of STEPS) {
    const dist = Math.abs(step - capped)
    if (dist < bestDist) {
      best = step
      bestDist = dist
    }
  }
  return best
}

function fits(occ: Uint8Array, x: number, y: number, side: number): boolean {
  if (x < 0 || y < 0 || x + side > GRID || y + side > GRID) return false
  for (let dy = 0; dy < side; dy++) {
    const row = (y + dy) * GRID + x
    for (let dx = 0; dx < side; dx++) {
      if (occ[row + dx]) return false
    }
  }
  return true
}

function mark(occ: Uint8Array, x: number, y: number, side: number) {
  for (let dy = 0; dy < side; dy++) {
    const row = (y + dy) * GRID + x
    for (let dx = 0; dx < side; dx++) occ[row + dx] = 1
  }
}

// Largest squares claim the focal point. Smaller ones settle in the nearest opening.
function pack(sides: Array<number>): Array<Placed> | null {
  const occ = new Uint8Array(GRID * GRID)
  const placed: Array<Placed> = []
  for (const side of sides) {
    const originX = Math.round(FOCUS_X - side / 2)
    const originY = Math.round(FOCUS_Y - side / 2)
    const found: { spot: Placed | null; closest: number } = {
      spot: null,
      closest: Infinity,
    }
    const consider = (x: number, y: number) => {
      if (!fits(occ, x, y, side)) return
      const dx = x + side / 2 - FOCUS_X
      const dy = y + side / 2 - FOCUS_Y
      const distance = dx * dx + dy * dy
      if (distance < found.closest) {
        found.closest = distance
        found.spot = { x, y, s: side }
      }
    }
    for (let ring = 0; ring < GRID && found.spot === null; ring++) {
      const top = originY - ring
      const bottom = originY + ring
      const left = originX - ring
      const right = originX + ring
      for (let x = left; x <= right; x++) {
        consider(x, top)
        if (ring > 0) consider(x, bottom)
      }
      for (let y = top + 1; y <= bottom - 1; y++) {
        consider(left, y)
        consider(right, y)
      }
    }
    if (found.spot === null) return null
    mark(occ, found.spot.x, found.spot.y, found.spot.s)
    placed.push(found.spot)
  }
  return placed
}

// Squares grow out from the middle of the block.
// `capacity` is the whole block. A block that did not fill keeps a quiet margin.
export function treemap<T extends { value: number }>(
  items: Array<T>,
  width: number,
  height: number,
  capacity?: number,
): Array<T & TreemapRect> {
  const live = items.filter((item) => item.value > 0)
  if (live.length === 0 || width <= 0 || height <= 0) {
    return items.map((item) => ({ ...item, x: 0, y: 0, w: 0, h: 0 }))
  }
  const total = live.reduce((sum, item) => sum + item.value, 0)
  const room = capacity && capacity > 0 ? capacity : total
  const fraction = Math.min(1, total / room)
  const ordered = [...live].sort((a, b) => b.value - a.value)

  let budget = fraction * GRID * GRID * 0.98
  let placed: Array<Placed> | null = null
  for (let attempt = 0; attempt < 20 && placed === null; attempt++) {
    const sides = ordered.map((item) =>
      snap(Math.sqrt((item.value / total) * budget)),
    )
    placed = pack(sides)
    budget *= 0.86
  }
  if (placed === null) {
    placed =
      pack(ordered.map(() => 1)) ?? ordered.map(() => ({ x: 0, y: 0, s: 1 }))
  }
  const settled = placed
  const span = Math.min(width, height)
  const originX = (width - span) / 2
  const originY = (height - span) / 2
  return ordered.map((item, index) => {
    const tile = settled[index]
    const side = (tile.s / GRID) * span
    return {
      ...item,
      x: originX + (tile.x / GRID) * span,
      y: originY + (tile.y / GRID) * span,
      w: side,
      h: side,
    }
  })
}
