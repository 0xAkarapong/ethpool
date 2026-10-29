import { describe, expect, test } from 'bun:test'
import { nextSticky } from './shell'

const ok = { ok: true as const, n: 1 }
const next = { ok: true as const, n: 2 }
const fail = { ok: false as const }

describe('last good page', () => {
  test('a failed refresh keeps the page that loaded', () => {
    const saved = nextSticky(null, '1', ok)
    expect(nextSticky(saved, '1', fail).data).toEqual(ok)
  })

  test('a different id does not keep the previous page', () => {
    const saved = nextSticky(null, '1', ok)
    expect(nextSticky(saved, '2', fail).data).toBeNull()
    expect(nextSticky(saved, '2', next).data).toEqual(next)
  })
})
