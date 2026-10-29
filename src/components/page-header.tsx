import { useRouterState } from '@tanstack/react-router'
import { Moon, Sun } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

const THEME_KEY = 'ethpool-theme'

export function PageHeader({
  title,
  subtitle,
  updatedAt,
  live,
  problem = 'offline',
  onRefresh,
}: {
  title: string
  subtitle: string
  updatedAt: number
  live: boolean
  problem?: 'offline' | 'other'
  onRefresh: () => void
}) {
  const [dark, setDark] = useState(false)
  const refreshing = useRouterState({
    select: (state) => state.status === 'pending',
  })

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
  }, [])

  function toggleTheme() {
    const next = !document.documentElement.classList.contains('dark')
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem(THEME_KEY, next ? 'dark' : 'light')
    setDark(next)
  }

  const clock = new Date(updatedAt)
  const stamp = `${String(clock.getUTCHours()).padStart(2, '0')}:${String(clock.getUTCMinutes()).padStart(2, '0')}:${String(clock.getUTCSeconds()).padStart(2, '0')} UTC`

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="font-heading text-[28px] font-medium leading-none">
          {title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border bg-card py-1 pr-2.5 pl-2 text-xs font-medium">
          <span
            className={cn(
              'size-1.5 rounded-full',
              live ? 'bg-chart-2' : 'bg-destructive',
            )}
          />
          {live ? 'Live' : problem === 'offline' ? 'RPC error' : 'Error'}
        </span>
        <span className="text-[13px] text-muted-foreground">
          {live ? 'Updated' : 'Last try'} {stamp}
        </span>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          className="inline-flex size-9 items-center justify-center rounded-lg border bg-card"
        >
          {dark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button
          type="button"
          onClick={onRefresh}
          className="rounded-lg border bg-card px-3 py-2 text-sm font-medium"
        >
          {refreshing ? 'Refreshing' : 'Refresh'}
        </button>
      </div>
    </div>
  )
}

export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  const offline = message === 'Could not reach Ethereum'
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive bg-fee-high-bg px-4 py-3">
      <div>
        <p className="text-sm font-medium text-fee-high">
          {offline ? 'Could not reach Ethereum' : message}
        </p>
        {offline ? (
          <p className="text-sm text-muted-foreground">
            Check the public RPC, then try again.
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-lg border bg-card px-3 py-2 text-sm font-medium"
      >
        Retry
      </button>
    </div>
  )
}
