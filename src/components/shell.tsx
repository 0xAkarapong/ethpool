import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { Cube, House, MagnifyingGlass } from '@phosphor-icons/react'
import { useCallback, useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { shortAddress } from '@/lib/format'
import {
  classifyQuery,
  readTracked,
  trackAddress,
  untrackAddress,
} from '@/lib/trace'
import { cn } from '@/lib/utils'
import { HostContext, TrackContext } from './shell-state'

export {
  nextSticky,
  useAutoRefresh,
  useReportHost,
  useStickyOk,
  useTrackedAddresses,
} from './shell-state'

export function AppShell({ children }: { children: ReactNode }) {
  const [host, setHost] = useState('eth.drpc.org')
  const [tracked, setTracked] = useState<Array<string>>([])
  const path = useRouterState({ select: (state) => state.location.pathname })

  useEffect(() => {
    setTracked(readTracked(localStorage))
  }, [])

  const track = useCallback((address: string) => {
    setTracked(trackAddress(localStorage, address))
  }, [])
  const untrack = useCallback((address: string) => {
    setTracked(untrackAddress(localStorage, address))
  }, [])

  return (
    <HostContext.Provider value={{ host, setHost }}>
      <TrackContext.Provider value={{ tracked, track, untrack }}>
        <div className="flex min-h-screen bg-muted text-foreground">
          <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-1 border-r bg-sidebar px-3 py-5 lg:flex">
            <Brand />
            <p className="px-2.5 pt-2 text-[11px] font-medium tracking-[0.06em] text-muted-foreground">
              MONITOR
            </p>
            <NavLink
              to="/"
              active={path === '/'}
              icon={House}
              label="Overview"
            />
            <NavLink
              to="/block/$blockId"
              params={{ blockId: 'latest' }}
              active={path.startsWith('/block')}
              icon={Cube}
              label="Blocks"
            />
            <p className="px-2.5 pt-4 text-[11px] font-medium tracking-[0.06em] text-muted-foreground">
              TRACE
            </p>
            <NavLink
              to="/trace"
              active={path === '/trace' || path.startsWith('/address')}
              icon={MagnifyingGlass}
              label="Addresses"
            />
            {tracked.map((address) => (
              <Link
                key={address}
                to="/address/$address"
                params={{ address }}
                className={cn(
                  'truncate rounded-lg px-2.5 py-1.5 font-mono text-xs',
                  path === `/address/${address}`
                    ? 'bg-muted font-medium text-foreground'
                    : 'text-muted-foreground',
                )}
              >
                {shortAddress(address)}
              </Link>
            ))}
            <div className="flex-1" />
            <div className="px-2.5 pt-3 text-xs">
              <p className="text-muted-foreground">Public RPC</p>
              <p className="font-mono text-foreground">{host}</p>
            </div>
          </aside>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-3 border-b bg-sidebar px-4 py-3 lg:hidden">
              <Brand compact />
              <nav className="flex gap-1 overflow-x-auto text-sm">
                <Link to="/" className="rounded-lg px-2 py-1">
                  Overview
                </Link>
                <Link
                  to="/block/$blockId"
                  params={{ blockId: 'latest' }}
                  className="rounded-lg px-2 py-1"
                >
                  Blocks
                </Link>
                <Link to="/trace" className="rounded-lg px-2 py-1">
                  Addresses
                </Link>
              </nav>
            </div>
            <div className="border-b bg-sidebar px-4 py-3 lg:px-6">
              <SearchForm />
            </div>
            <div className="flex-1 px-4 py-6 lg:px-6">{children}</div>
          </div>
        </div>
      </TrackContext.Provider>
    </HostContext.Provider>
  )
}

function SearchForm() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const hit = classifyQuery(query)
    if (!hit.ok) {
      setError(hit.message)
      return
    }
    setError(null)
    if (hit.kind === 'address' || hit.kind === 'ens') {
      void navigate({
        to: '/address/$address',
        params: { address: hit.kind === 'ens' ? hit.name : hit.address },
      })
      return
    }
    if (hit.kind === 'tx') {
      void navigate({ to: '/tx/$hash', params: { hash: hit.hash } })
      return
    }
    void navigate({ to: '/block/$blockId', params: { blockId: hit.blockId } })
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto flex w-full max-w-6xl flex-col gap-1"
    >
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search address, ENS name, transaction, or block"
          placeholder="Address, ENS, transaction, or block"
          className="w-full min-w-0 rounded-lg border bg-card px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-lg border bg-card px-3 py-2 text-sm font-medium"
        >
          Search
        </button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </form>
  )
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 px-2 pb-4',
        compact && 'px-0 pb-0',
      )}
    >
      <div className="flex size-8 items-center justify-center rounded-lg bg-primary font-heading text-base font-bold text-primary-foreground">
        E
      </div>
      {compact ? null : (
        <div>
          <p className="font-heading text-base font-medium">ETHPOOL</p>
          <p className="text-xs text-muted-foreground">Ethereum mainnet</p>
        </div>
      )}
    </div>
  )
}

function NavLink({
  active,
  icon: Icon,
  label,
  ...link
}: {
  active: boolean
  icon: typeof House
  label: string
  to: '/' | '/block/$blockId' | '/tx/$hash' | '/address/$address' | '/trace'
  params?: { blockId: string } | { hash: string } | { address: string }
  hash?: string
}) {
  return (
    <Link
      {...link}
      className={cn(
        'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm',
        active
          ? 'bg-muted font-medium text-foreground'
          : 'text-muted-foreground',
      )}
    >
      <Icon size={16} />
      {label}
    </Link>
  )
}

export { ErrorBanner, PageHeader } from './page-header'
