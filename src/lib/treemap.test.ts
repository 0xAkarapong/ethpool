import { describe, expect, test } from 'bun:test'
import { treemap } from './treemap'

function overlap(
  a: { x: number; y: number; w: number; h: number },
  b: typeof a,
) {
  const width = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
  const height = Math.max(
    0,
    Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y),
  )
  return width * height
}

function many(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: index,
    value: 21_000 + (index % 6) * 18_000 + (index % 17) * 40_000,
  }))
}

describe('treemap', () => {
  test('payments are squares and do not cover each other', () => {
    const rects = treemap(many(48), 788, 788)
    expect(rects).toHaveLength(48)
    for (const rect of rects) {
      expect(rect.w).toBeCloseTo(rect.h)
      expect(rect.w).toBeGreaterThan(0)
      expect(rect.x).toBeGreaterThanOrEqual(-0.001)
      expect(rect.y).toBeGreaterThanOrEqual(-0.001)
      expect(rect.x + rect.w).toBeLessThanOrEqual(788 + 0.001)
      expect(rect.y + rect.h).toBeLessThanOrEqual(788 + 0.001)
    }
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        expect(overlap(rects[i], rects[j])).toBeLessThan(0.01)
      }
    }
  })

  test('more gas makes a bigger square', () => {
    const rects = treemap(
      [
        { id: 'small', value: 4_000 },
        { id: 'big', value: 64_000 },
      ],
      400,
      400,
    )
    const small = rects.find((rect) => rect.id === 'small')
    const big = rects.find((rect) => rect.id === 'big')
    expect(big && small && big.w).toBeGreaterThan(small.w)
  })

  test('unused room stays around the mosaic, not in one corner', () => {
    const payments = many(36)
    const used = payments.reduce((sum, item) => sum + item.value, 0)
    const rects = treemap(payments, 788, 788, used * 3)
    const area = rects.reduce((sum, rect) => sum + rect.w * rect.h, 0)
    const cx =
      rects.reduce(
        (sum, rect) => sum + (rect.x + rect.w / 2) * rect.w * rect.h,
        0,
      ) / area
    const cy =
      rects.reduce(
        (sum, rect) => sum + (rect.y + rect.h / 2) * rect.w * rect.h,
        0,
      ) / area
    expect(cx).toBeGreaterThan(788 * 0.4)
    expect(cx).toBeLessThan(788 * 0.6)
    expect(cy).toBeGreaterThan(788 * 0.4)
    expect(cy).toBeLessThan(788 * 0.6)
    expect(Math.min(...rects.map((rect) => rect.x))).toBeGreaterThan(40)
    expect(Math.min(...rects.map((rect) => rect.y))).toBeGreaterThan(40)
  })
})
