export function fail(error: unknown): {
  ok: false
  host: string
  updatedAt: number
  message: string
} {
  const message =
    error instanceof Error ? error.message : 'Could not reach Ethereum'
  const reachable =
    /could not reach|timeout|timed out|abort|fetch|network/i.test(message)
  return {
    ok: false,
    host: 'eth.drpc.org',
    updatedAt: Date.now(),
    message: reachable ? 'Could not reach Ethereum' : message,
  }
}
