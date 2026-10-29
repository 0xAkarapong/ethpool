import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import type { TxCell } from '@/lib/chain'
import { formatGwei, formatNumber, shortAddress } from '@/lib/format'
import { cn } from '@/lib/utils'

export function PaymentDetail({
  tx,
  baseFee,
  tone,
}: {
  tx: TxCell
  baseFee: number
  tone: (gwei: number) => { color: string }
}) {
  return (
    <aside className="rounded-[10px] border bg-card p-5">
      <p className="text-[13px] font-medium text-muted-foreground">
        Fee this payment paid
      </p>
      <p
        className="mt-1 font-heading text-3xl font-medium"
        style={{ color: tone(tx.feeGwei).color }}
      >
        {formatGwei(tx.feeGwei)}
        <span className="ml-1 text-sm font-normal text-muted-foreground">
          gwei
        </span>
      </p>
      <dl className="mt-4 space-y-3 text-sm">
        <Row label="Payment">
          <Link
            to="/tx/$hash"
            params={{ hash: tx.hash }}
            className="underline-offset-2 hover:underline"
          >
            {shortAddress(tx.hash)}
          </Link>
        </Row>
        <Row label="Sent by">
          <Link
            to="/address/$address"
            params={{ address: tx.from }}
            className="underline-offset-2 hover:underline"
          >
            {shortAddress(tx.from)}
          </Link>
        </Row>
        <Row label="Received by">
          {tx.to ? (
            <Link
              to="/address/$address"
              params={{ address: tx.to }}
              className="underline-offset-2 hover:underline"
            >
              {tx.toName ?? shortAddress(tx.to)}
            </Link>
          ) : (
            'A new program'
          )}
        </Row>
        <Row label="Gas used">{formatNumber(tx.gas)}</Row>
        <Row label="Ether sent">
          {tx.valueEth === '0.0000' ? '0 ETH' : `${tx.valueEth} ETH`}
        </Row>
        <Row label="Minimum fee in this batch">{`${formatGwei(baseFee)} gwei`}</Row>
      </dl>
      <Link
        to="/tx/$hash"
        params={{ hash: tx.hash }}
        className="mt-5 inline-flex rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
      >
        Open this payment
      </Link>
    </aside>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium break-all">{children}</dd>
    </div>
  )
}

export function HighestFees({
  txs,
  tone,
  picked,
  onPick,
}: {
  txs: Array<TxCell>
  tone: (gwei: number) => { color: string }
  picked: string | null
  onPick: (hash: string) => void
}) {
  const hot = [...txs].sort((a, b) => b.feeGwei - a.feeGwei).slice(0, 6)
  if (hot.length === 0) return null
  return (
    <div className="rounded-[10px] border bg-card p-4">
      <p className="text-xs text-muted-foreground">Highest fees</p>
      <ul className="mt-2 space-y-1">
        {hot.map((tx) => (
          <li key={tx.hash}>
            <button
              type="button"
              onClick={() => onPick(tx.hash)}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted',
                tx.hash === picked && 'bg-muted',
              )}
            >
              <span
                className="size-2.5 shrink-0 rounded-sm"
                style={{ background: tone(tx.feeGwei).color }}
              />
              <span className="w-14 shrink-0 font-medium">
                {formatGwei(tx.feeGwei)}
              </span>
              <span className="truncate text-muted-foreground">
                {shortAddress(tx.hash)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
