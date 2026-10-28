import { afterEach, describe, expect, test } from 'bun:test'
import { loadAddress, loadOverview } from './chain'
import { formatEth } from './format'

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

  test('loads balance, account type, and the next hop', async () => {
    const subject = `0x${'ab'.repeat(20)}`
    const counterparty = `0x${'ef'.repeat(20)}`
    const hash = `0x${'cd'.repeat(32)}`
    const wei = 10n ** 18n
    globalThis.fetch = ((input, init) => {
      const url = String(input)
      if (url.includes('routescan.io')) {
        return Promise.resolve(
          Response.json({
            status: '1',
            message: 'OK',
            result: [
              {
                hash,
                from: subject,
                to: counterparty,
                value: wei.toString(),
                timeStamp: '1700000000',
                isError: '0',
              },
              {
                hash,
                from: subject,
                to: counterparty,
                value: wei.toString(),
                timeStamp: '1700000000',
                isError: '0',
              },
            ],
          }),
        )
      }
      const payload = JSON.parse(String(init?.body)) as { method: string }
      const result =
        payload.method === 'eth_getBalance'
          ? `0x${wei.toString(16)}`
          : payload.method === 'eth_getTransactionCount'
            ? '0x2a'
            : payload.method === 'eth_getCode'
              ? '0x'
              : null
      if (!result) throw new Error(`unexpected method ${payload.method}`)
      return Promise.resolve(Response.json({ jsonrpc: '2.0', id: 1, result }))
    }) as typeof fetch

    const result = await loadAddress(subject.toUpperCase())
    if (!result.ok) throw new Error(result.message)
    expect(result.address).toBe(subject)
    expect(result.balanceEth).toBe(formatEth(wei))
    expect(result.txCount).toBe(42)
    expect(result.contract).toBe(false)
    expect(result.transfers).toHaveLength(1)
    const hop = result.transfers[0]
    expect(hop.direction).toBe('out')
    expect(hop.counterparty).toBe(counterparty)
    expect(hop.amountEth).toBe(formatEth(wei))
    expect(hop.hash).toBe(hash)
    expect(hop.addressTo).toBe(`/address/${counterparty}`)
    expect(hop.txTo).toBe(`/tx/${hash}`)
  })

  test('an indexer failure keeps the balance and reports history separately', async () => {
    const subject = `0x${'ab'.repeat(20)}`
    const wei = 10n ** 18n
    globalThis.fetch = ((input, init) => {
      const url = String(input)
      if (url.includes('routescan.io')) {
        return Promise.reject(new Error('fetch failed'))
      }
      const payload = JSON.parse(String(init?.body)) as { method: string }
      const result =
        payload.method === 'eth_getBalance'
          ? `0x${wei.toString(16)}`
          : payload.method === 'eth_getTransactionCount'
            ? '0x2'
            : payload.method === 'eth_getCode'
              ? '0x'
              : null
      if (!result) throw new Error(`unexpected method ${payload.method}`)
      return Promise.resolve(Response.json({ jsonrpc: '2.0', id: 1, result }))
    }) as typeof fetch

    const result = await loadAddress(subject)
    if (!result.ok) throw new Error(result.message)
    expect(result.balanceEth).toBe(formatEth(wei))
    expect(result.txCount).toBe(2)
    expect(result.contract).toBe(false)
    expect(result.transfers).toEqual([])
    expect(result.historyMessage).toBe('Could not reach Ethereum')
  })

  test('a failed fetch is a structured error', async () => {
    globalThis.fetch = (() =>
      Promise.reject(new Error('fetch failed'))) as typeof fetch
    const result = await loadAddress(`0x${'ab'.repeat(20)}`)
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected a failure')
    expect(result.message).toBe('Could not reach Ethereum')
  })

  test('a bad address does not throw', async () => {
    const result = await loadAddress('nope')
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected a failure')
    expect(result.message).toBe('Invalid address')
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
