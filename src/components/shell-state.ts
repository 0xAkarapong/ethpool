import { useRouter } from '@tanstack/react-router'
import { createContext, useContext, useEffect, useState } from 'react'

export const HostContext = createContext<{
  host: string
  setHost: (host: string) => void
}>({
  host: 'eth.drpc.org',
  setHost: () => {},
})

export function useReportHost(host: string | undefined) {
  const { setHost } = useContext(HostContext)
  useEffect(() => {
    if (host) setHost(host)
  }, [host, setHost])
}

export function useAutoRefresh(ms = 20_000) {
  const router = useRouter()
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!document.hidden) void router.invalidate()
    }, ms)
    return () => window.clearInterval(id)
  }, [router, ms])
}

type StickyOk<T extends { ok: true }> = { key: string; data: T | null }

export function nextSticky<T extends { ok: true }>(
  previous: StickyOk<T> | null,
  key: string,
  result: T | { ok: false },
): StickyOk<T> {
  if (!previous || previous.key !== key)
    return { key, data: result.ok ? result : null }
  if (result.ok) return { key, data: result }
  return previous
}

export function useStickyOk<T extends { ok: true }>(
  key: string,
  result: T | { ok: false },
): T | null {
  const [state, setState] = useState(() => nextSticky(null, key, result))
  if (state.key !== key) setState(nextSticky(null, key, result))

  useEffect(() => {
    if (result.ok) setState({ key, data: result })
  }, [key, result])

  return state.key === key ? state.data : result.ok ? result : null
}

export const TrackContext = createContext<{
  tracked: Array<string>
  track: (address: string) => void
  untrack: (address: string) => void
}>({
  tracked: [],
  track: () => {},
  untrack: () => {},
})

export function useTrackedAddresses() {
  return useContext(TrackContext)
}
