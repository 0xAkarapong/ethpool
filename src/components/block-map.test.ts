import { describe, expect, test } from 'bun:test'
import { heatGradient } from './block-map'

describe('heatGradient', () => {
  test('walks from the cheapest fee to the dearest', () => {
    const tone = (gwei: number) => ({ color: gwei < 1 ? 'green' : 'red' })
    const stops = heatGradient(tone, [0.1, 0.2, 5])
    expect(stops[0]).toBe('green')
    expect(stops[stops.length - 1]).toBe('red')
    expect(stops.length).toBe(6)
  })

  test('one price paints one color', () => {
    const tone = () => ({ color: 'green' })
    expect(heatGradient(tone, [0.2, 0.2])).toEqual(['green', 'green'])
  })
})
