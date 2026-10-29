export function asHex(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('0x'))
    throw new Error('Unexpected RPC value')
  return value
}

export function hexToNumber(hex: string): number {
  return Number(BigInt(hex))
}

export function hexToGwei(hex: string): number {
  return Number(BigInt(hex)) / 1e9
}

export function hexOf(value: number): string {
  return `0x${value.toString(16)}`
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
