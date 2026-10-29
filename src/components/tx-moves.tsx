import { Link } from '@tanstack/react-router'
import type { TokenMove } from '@/lib/tokens'
import { shortAddress } from '@/lib/format'
import { cn } from '@/lib/utils'

const ZERO_ADDRESS = `0x${'0'.repeat(40)}`

export function TokenMoves({
  tokens,
  more,
}: {
  tokens: Array<TokenMove>
  more: number
}) {
  if (tokens.length === 0) return null
  return (
    <section className="rounded-[10px] border bg-card p-4">
      <p className="text-sm text-muted-foreground">
        Each row is one token moving between two accounts.
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {tokens.map((move, index) => (
          <li
            key={`${move.token}-${move.from}-${move.to}-${index}`}
            className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 rounded-lg bg-background px-3 py-2"
          >
            <Account address={move.from} empty="Minted" />
            <Link
              to="/address/$address"
              params={{ address: move.token }}
              className="text-center underline-offset-2 hover:underline"
            >
              <span className="font-heading text-sm font-medium">
                {move.amount}
              </span>
              <span className="ml-1 text-xs text-muted-foreground">
                {move.symbol}
              </span>
            </Link>
            <Account address={move.to} empty="Burned" align="end" />
          </li>
        ))}
      </ul>
      {more > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {`${more} more token transfers are in this payment.`}
        </p>
      ) : null}
    </section>
  )
}

function Account({
  address,
  empty,
  align,
}: {
  address: string
  empty: string
  align?: 'end'
}) {
  const className = cn('truncate text-sm', align === 'end' && 'text-right')
  if (address === ZERO_ADDRESS) {
    return (
      <span className={cn(className, 'text-muted-foreground')}>{empty}</span>
    )
  }
  return (
    <Link
      to="/address/$address"
      params={{ address }}
      className={cn(className, 'underline-offset-2 hover:underline')}
    >
      {shortAddress(address)}
    </Link>
  )
}
