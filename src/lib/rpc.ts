export type Call = { method: string; params: Array<unknown> }

const ENDPOINTS = [
  'https://eth.drpc.org',
  'https://ethereum-rpc.publicnode.com',
  'https://1rpc.io/eth',
  'https://rpc.flashbots.net',
  'https://eth-mainnet.public.blastapi.io',
  'https://virginia.rpc.blxrbdn.com',
]

const quietUntil = new Map<string, number>()
let lastWinner: string | null = null

function isUnreachable(error: unknown): boolean {
  const message =
    error instanceof Error
      ? `${error.message} ${'cause' in error ? String(error.cause) : ''}`
      : ''
  return /could not reach|fetch|timeout|network|econnreset|abort|socket hang up|too many requests|rate limit/i.test(
    message,
  )
}

// One hung public RPC must not hold the page. Bun closes a dev request that
// sends no bytes for 10s, which drops the block map before it renders.
export const ATTEMPT_MS = 4_000

export async function callFirst(calls: Array<Call>) {
  const now = Date.now()
  const open = ENDPOINTS.filter((url) => (quietUntil.get(url) ?? 0) < now)
  const urls = open.length > 0 ? open : ENDPOINTS
  const preferred =
    lastWinner && (quietUntil.get(lastWinner) ?? 0) < now ? lastWinner : null
  if (preferred && urls.includes(preferred)) {
    try {
      const result = await callAt(
        preferred,
        calls,
        AbortSignal.timeout(ATTEMPT_MS),
      )
      lastWinner = preferred
      return result
    } catch (error) {
      if (isUnreachable(error)) quietUntil.set(preferred, Date.now() + 20_000)
      const rest = urls.filter((url) => url !== preferred)
      if (rest.length === 0) {
        throw error instanceof Error
          ? error
          : new Error('Could not reach Ethereum')
      }
      return race(rest, calls)
    }
  }
  return race(urls, calls)
}

async function race(urls: Array<string>, calls: Array<Call>) {
  const controllers = urls.map(() => new AbortController())
  const timer = setTimeout(() => {
    for (const controller of controllers) controller.abort()
  }, ATTEMPT_MS)
  const attempts = urls.map((url, index) =>
    callAt(url, calls, controllers[index].signal).then(
      (result) => {
        for (const [other, controller] of controllers.entries()) {
          if (other !== index) controller.abort()
        }
        return result
      },
      (error: unknown) => {
        // An abort we issued means another host already won, or the 4s cap hit.
        if (!controllers[index].signal.aborted && isUnreachable(error)) {
          quietUntil.set(url, Date.now() + 20_000)
        }
        throw error
      },
    ),
  )

  try {
    const result = await Promise.any(attempts)
    lastWinner = result.url
    return result
  } catch (error) {
    const list = error instanceof AggregateError ? error.errors : [error]
    const last = list.find((entry) => entry instanceof Error)
    throw last instanceof Error ? last : new Error('Could not reach Ethereum')
  } finally {
    clearTimeout(timer)
    for (const attempt of attempts) attempt.catch(() => {})
  }
}

export async function callAt(
  url: string,
  calls: Array<Call>,
  signal = AbortSignal.timeout(ATTEMPT_MS),
) {
  const results = await mapPool(calls, 3, (call) => callOne(url, call, signal))
  return { url, host: new URL(url).host, results }
}

async function callOne(
  url: string,
  call: Call,
  signal: AbortSignal,
): Promise<unknown> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: call.method,
      params: call.params,
    }),
    signal,
  })
  const body: unknown = await response.json().catch(() => null)
  if (!isRecord(body)) throw new Error('Could not reach Ethereum')
  if (body.error) {
    const message =
      isRecord(body.error) && typeof body.error.message === 'string'
        ? body.error.message
        : 'RPC error'
    throw new Error(message)
  }
  if (!response.ok) throw new Error('Could not reach Ethereum')
  return body.result
}

export async function callMaybe(
  url: string,
  call: Call,
): Promise<unknown | null> {
  try {
    return await callOne(url, call, AbortSignal.timeout(ATTEMPT_MS))
  } catch {
    return null
  }
}

export async function mapPool<T, TResult>(
  items: Array<T>,
  limit: number,
  run: (item: T) => Promise<TResult>,
): Promise<Array<TResult>> {
  const results = new Array<TResult>(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const index = next
      next += 1
      results[index] = await run(items[index])
    }
  }
  const workers = Math.min(limit, items.length)
  await Promise.all(Array.from({ length: workers }, () => worker()))
  return results
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
