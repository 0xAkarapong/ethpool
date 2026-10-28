import { normalizeAddress } from './trace'

// ERC-20 and ERC-721 Transfer(address,address,uint256). Hardcoded so the page
// does not need a hash library. ERC-1155 batches are a different event.
const TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

export const TOKEN_MOVE_CAP = 12

export type TokenLog = {
  address: string
  topics: Array<string>
  data: string
}

export type RawTokenMove = {
  token: string
  from: string
  to: string
  raw: bigint
  tokenId: string | null
}

export type TokenMove = {
  token: string
  symbol: string
  from: string
  to: string
  amount: string
}

export function readTokenMoves(logs: Array<TokenLog>): Array<RawTokenMove> {
  const moves: Array<RawTokenMove> = []
  for (const log of logs) {
    const topics = log.topics
    if (topics[0]?.toLowerCase() !== TRANSFER_TOPIC) continue
    const token = normalizeAddress(log.address)
    const from = topicAddress(topics[1])
    const to = topicAddress(topics[2])
    if (!token || !from || !to) continue
    if (topics.length === 3) {
      const raw = uint256(log.data)
      if (raw === null || raw === 0n) continue
      moves.push({ token, from, to, raw, tokenId: null })
      continue
    }
    if (topics.length === 4) {
      const id = uint256(topics[3] ?? '')
      if (id === null) continue
      const text = id.toString()
      moves.push({
        token,
        from,
        to,
        raw: 1n,
        tokenId:
          text.length > 12 ? `${text.slice(0, 4)}…${text.slice(-4)}` : text,
      })
    }
  }
  return moves
}

export function formatTokenAmount(raw: bigint, decimals: number): string {
  if (raw === 0n) return '0'
  if (decimals <= 0) return group(raw)
  const scale = 10n ** BigInt(decimals)
  const whole = raw / scale
  let fraction = (raw % scale).toString().padStart(decimals, '0')
  if (decimals > 6 && (whole > 0n || /[1-9]/.test(fraction.slice(0, 6)))) {
    fraction = fraction.slice(0, 6)
  }
  fraction = fraction.replace(/0+$/, '')
  return fraction ? `${group(whole)}.${fraction}` : group(whole)
}

export function readSymbol(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('0x')) return null
  const text = decodeAbiString(value)
  if (!text) return null
  const clean = text.replace(/[^\x20-\x7e]/g, '').trim()
  if (!clean || clean.length > 24) return null
  return clean
}

export function readDecimals(value: unknown): number | null {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]+$/.test(value)) return null
  const decimals = Number(BigInt(value))
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) return null
  return decimals
}

function decodeAbiString(hex: string): string | null {
  const body = hex.slice(2)
  if (body.length === 0) return null
  if (body.length <= 64) return bytesToText(body)
  if (body.length < 128) return null
  const length = Number(BigInt(`0x${body.slice(64, 128)}`))
  if (!Number.isInteger(length) || length < 0 || length > 64) return null
  return bytesToText(body.slice(128, 128 + length * 2))
}

function bytesToText(hex: string): string {
  let text = ''
  for (let index = 0; index < hex.length; index += 2) {
    const byte = Number.parseInt(hex.slice(index, index + 2), 16)
    if (byte === 0) continue
    text += String.fromCharCode(byte)
  }
  return text
}

function topicAddress(topic: string | undefined): string | null {
  if (!topic?.startsWith('0x') || topic.length < 42) return null
  return normalizeAddress(`0x${topic.slice(-40)}`)
}

function uint256(hex: string): bigint | null {
  if (!/^0x[0-9a-fA-F]*$/.test(hex)) return null
  if (hex.length > 66) return null
  if (hex === '0x') return 0n
  return BigInt(hex)
}

function group(value: bigint): string {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
