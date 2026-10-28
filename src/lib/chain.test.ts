import { afterEach, describe, expect, test } from 'bun:test'
import { loadOverview } from './chain'

const realFetch = globalThis.fetch

describe('rpc failover', () => {
  afterEach(() => {
    globalThis.fetch = realFetch
  })

  test('answers from a live host while another RPC hangs', async () => {
    globalThis.fetch = ((input, init) => {
      const url = String(input)
      if (!url.includes('1rpc.io')) {
        return new Promise((_resolve, reject) => {
          const abort = () =>
            reject(new DOMException('The operation was aborted.', 'AbortError'))
          if (init?.signal?.aborted) abort()
          else init?.signal?.addEventListener('abort', abort, { once: true })
        })
      }
      const payload = JSON.parse(String(init?.body)) as { method: string }
      return Promise.resolve(
        Response.json({
          jsonrpc: '2.0',
          id: 1,
          result: resultFor(payload.method),
        }),
      )
    }) as typeof fetch

    const started = Date.now()
    const result = await loadOverview()
    expect(Date.now() - started).toBeLessThan(3_000)
    if (!result.ok) throw new Error(result.message)
    expect(result.latest.number).toBe(100)
    expect(result.blocks.length).toBeGreaterThan(0)
  })
})

function resultFor(method: string): unknown {
  if (method === 'eth_feeHistory') {
    return {
      baseFeePerGas: ['0x5f5e100', '0x5f5e100', '0x5f5e100'],
      reward: [['0x3b9aca00', '0x77359400', '0x1dcd6500']],
    }
  }
  if (method === 'eth_blockNumber') return '0x64'
  if (method === 'eth_getBlockByNumber') {
    return {
      number: '0x64',
      hash: '0xabc',
      parentHash: '0xdef',
      timestamp: '0x65',
      gasUsed: '0x1',
      gasLimit: '0x2',
      baseFeePerGas: '0x5f5e100',
      transactions: ['0x01'],
    }
  }
  if (method === 'eth_getBlockTransactionCountByNumber') return '0x2'
  throw new Error(`unexpected method ${method}`)
}
