import { Link } from '@tanstack/react-router'
import { shortAddress } from '@/lib/format'

const FLOW_W = 880
const FLOW_H = 240
const FLOW_TOP = 36
const FLOW_TRACK = 168

export type RibbonPart = {
  key: 'value' | 'burn' | 'tip'
  amount: number
  title: string
  caption: string
  eth: string
  stroke: string
}

/** Ribbon thickness follows the square root of the ether, so a fee stays visible beside a large payment. */
export function splitRibbons<T extends { amount: number }>(
  parts: Array<T>,
  top = FLOW_TOP,
  height = FLOW_TRACK,
): Array<T & { y: number; h: number }> {
  const live = parts.filter((part) => part.amount > 0)
  if (live.length === 0) return []
  const gap = 20
  const weights = live.map((part) => Math.sqrt(part.amount))
  const sum = weights.reduce((total, weight) => total + weight, 0)
  const room = Math.max(0, height - gap * (live.length - 1))
  let y = top
  return live.map((part, index) => {
    const h = ((weights[index] ?? 0) / sum) * room
    const ribbon = { ...part, y, h }
    y += h + gap
    return ribbon
  })
}

export function Split({
  from,
  to,
  toName,
  totalEth,
  valueEth,
  burnedEth,
  tipEth,
}: {
  from: string
  to: string | null
  toName: string | null
  totalEth: string
  valueEth: string
  burnedEth: string
  tipEth: string
}) {
  const ribbons = splitRibbons([
    {
      key: 'value' as const,
      amount: Number(valueEth),
      title: to ? (toName ?? shortAddress(to)) : 'A new program',
      caption: 'Arrived',
      eth: valueEth,
      stroke: 'var(--flow-value)',
    },
    {
      key: 'burn' as const,
      amount: Number(burnedEth),
      title: 'Destroyed',
      caption: 'Burned',
      eth: burnedEth,
      stroke: 'var(--flow-burn)',
    },
    {
      key: 'tip' as const,
      amount: Number(tipEth),
      title: 'Block producer',
      caption: 'Tip',
      eth: tipEth,
      stroke: 'var(--flow-tip)',
    },
  ])
  if (ribbons.length === 0) {
    return <p className="text-sm text-muted-foreground">No ether moved.</p>
  }

  const first = ribbons[0]
  const last = ribbons[ribbons.length - 1]
  const sourceY = (first.y + last.y + last.h) / 2

  return (
    <div className="relative aspect-[880/240] w-full overflow-hidden rounded-[10px] border bg-background">
      <svg
        viewBox={`0 0 ${FLOW_W} ${FLOW_H}`}
        className="pointer-events-none absolute inset-0 h-full w-full"
      >
        {ribbons.map((ribbon) => {
          const y2 = ribbon.y + ribbon.h / 2
          const d = `M 156 ${sourceY} C 340 ${sourceY}, 540 ${y2}, 724 ${y2}`
          return (
            <g key={ribbon.key}>
              <path
                d={d}
                fill="none"
                stroke={ribbon.stroke}
                strokeWidth={Math.min(42, Math.max(10, ribbon.h * 0.85))}
                strokeOpacity="0.4"
                strokeLinecap="round"
              />
              <path
                d={d}
                fill="none"
                stroke={ribbon.stroke}
                strokeWidth="3.5"
                strokeLinecap="round"
                className="ether-line"
              />
            </g>
          )
        })}
      </svg>
      <End
        x={108}
        y={sourceY}
        href={{ to: '/address/$address', address: from }}
        title={shortAddress(from)}
        caption="Sent"
        amount={`${totalEth} ETH`}
        stroke="var(--foreground)"
      />
      {ribbons.map((ribbon) => (
        <End
          key={ribbon.key}
          x={760}
          y={ribbon.y + ribbon.h / 2}
          href={
            ribbon.key === 'value' && to
              ? { to: '/address/$address', address: to }
              : null
          }
          title={ribbon.title}
          caption={ribbon.caption}
          amount={`${ribbon.eth} ETH`}
          stroke={ribbon.stroke}
        />
      ))}
    </div>
  )
}

function End({
  x,
  y,
  href,
  title,
  caption,
  amount,
  stroke,
}: {
  x: number
  y: number
  href: { to: '/address/$address'; address: string } | null
  title: string
  caption: string
  amount: string
  stroke: string
}) {
  const body = (
    <span className="flex flex-col items-center text-center">
      <span
        className="flex size-14 flex-col items-center justify-center rounded-full border-2 text-white"
        style={{
          borderColor: stroke,
          background: `color-mix(in srgb, ${stroke} 58%, transparent)`,
          boxShadow: `0 0 18px color-mix(in srgb, ${stroke} 45%, transparent)`,
        }}
      >
        <span className="font-heading text-[11px] font-medium">{caption}</span>
      </span>
      <span className="mt-1 max-w-28 truncate text-xs font-medium">
        {title}
      </span>
      <span className="font-heading text-xs">{amount}</span>
    </span>
  )
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-7"
      style={{
        left: `${((x / FLOW_W) * 100).toFixed(2)}%`,
        top: `${((y / FLOW_H) * 100).toFixed(2)}%`,
      }}
    >
      {href ? (
        <Link
          to={href.to}
          params={{ address: href.address }}
          aria-label={`${caption} ${title}`}
          className="rounded-full"
        >
          {body}
        </Link>
      ) : (
        body
      )}
    </div>
  )
}
