export type CallView =
  | { kind: 'transfer' }
  | { kind: 'create' }
  | { kind: 'call'; name: string; selector: string; known: boolean }

// shortcut: a few common calls, show the raw selector when a program uses another one
const CALLS: Record<string, string> = {
  '0xa9059cbb': 'send tokens',
  '0x23b872dd': 'send tokens from another account',
  '0x095ea7b3': 'allow a program to spend tokens',
  '0xd0e30db0': 'wrap ether',
  '0x2e1a7d4d': 'unwrap ether',
  '0x3593564c': 'run a swap',
  '0x5ae401dc': 'run several steps',
  '0xac9650d8': 'run several steps',
  '0x38ed1739': 'swap tokens',
  '0x7ff36ab5': 'swap ether for tokens',
  '0x18cbafe5': 'swap tokens for ether',
  '0x04e45aaf': 'swap on a pool',
  '0x414bf389': 'swap on a pool',
  '0xa22cb465': 'allow a program to move collectibles',
  '0x42842e0e': 'send a collectible',
  '0x40c10f19': 'mint tokens',
}

export function describeCall(
  input: string | null | undefined,
  to: string | null,
): CallView {
  if (to === null) return { kind: 'create' }
  const data = (input ?? '0x').toLowerCase()
  if (!data.startsWith('0x') || data.length < 10) return { kind: 'transfer' }
  const selector = data.slice(0, 10)
  const name = Object.hasOwn(CALLS, selector) ? CALLS[selector] : null
  return {
    kind: 'call',
    name: name ?? 'run a program',
    selector,
    known: name !== null,
  }
}

export function readStatus(status: string | undefined): boolean | null {
  if (status === '0x1' || status === '0x01') return true
  if (status === '0x0' || status === '0x00') return false
  return null
}
