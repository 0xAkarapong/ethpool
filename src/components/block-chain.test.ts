import { expect, test } from 'bun:test'
import { fullnessTone } from './block-chain'

test('an empty block and a full block are different colors', () => {
  expect(fullnessTone(0)).toBe('rgb(76 29 149)')
  expect(fullnessTone(100)).toBe('rgb(8 145 178)')
  expect(fullnessTone(50)).not.toBe(fullnessTone(0))
})
