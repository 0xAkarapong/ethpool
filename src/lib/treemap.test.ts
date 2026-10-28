import { describe, expect, test } from 'bun:test'
import { treemap } from './treemap'

function overlap(a: { x: number; y: number; w: number; h: number }, b: typeof a) {
  const width = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
  const height = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
  return width * height
}

describe('treemap', () => {
  test('fills the frame without overlapping', () => {
    const rects = treemap(
      [
        { value: 20_000 },
        { value: 180_000 },
        { value: 40_000 },
        { value: 90_000 },
      ],
      788,
      520,
    )
    const area = rects.reduce((sum, rect) => sum + rect.w * rect.h, 0)
    expect(area).toBeCloseTo(788 * 520, 4)
    for (const rect of rects) {
      expect(rect.x).toBeGreaterThanOrEqual(-0.001)
      expect(rect.y).toBeGreaterThanOrEqual(-0.001)
      expect(rect.x + rect.w).toBeLessThanOrEqual(788 + 0.001)
      expect(rect.y + rect.h).toBeLessThanOrEqual(520 + 0.001)
    }
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        expect(overlap(rects[i], rects[j])).toBeLessThan(0.01)
      }
    }
  })
})
