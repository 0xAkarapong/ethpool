import { describe, expect, test } from 'bun:test'
import { describeCall, readStatus } from './call'

const to = `0x${'ab'.repeat(20)}`

describe('what a transaction asked', () => {
  test('ether with no extra data is just a payment', () => {
    expect(describeCall('0x', to)).toEqual({ kind: 'transfer' })
  })

  test('a known call is named, and an unknown one keeps its selector', () => {
    expect(describeCall(`0x3593564c${'00'.repeat(4)}`, to)).toMatchObject({
      kind: 'call',
      name: 'run a swap',
      known: true,
    })
    expect(describeCall('0xdeadbeef', to)).toEqual({
      kind: 'call',
      name: 'run a program',
      selector: '0xdeadbeef',
      known: false,
    })
  })

  test('no destination means a new program', () => {
    expect(describeCall('0x60806040', null)).toEqual({ kind: 'create' })
  })

  test('a receipt says whether the program accepted it', () => {
    expect(readStatus('0x1')).toBe(true)
    expect(readStatus('0x0')).toBe(false)
    expect(readStatus(undefined)).toBeNull()
  })
})
