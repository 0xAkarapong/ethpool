import { motion, MotionConfig, useReducedMotion } from 'framer-motion'
import type { TxCell } from '@/lib/chain'
import { formatGwei, formatNumber, shortAddress } from '@/lib/format'
import { cn } from '@/lib/utils'

const MAP = 788

type Cell = TxCell & { x: number; y: number; w: number; h: number }

function tileFrame(cell: { x: number; y: number; w: number; h: number }) {
  return {
    left: `calc(${(cell.x / MAP) * 100}% + 1.5px)`,
    top: `calc(${(cell.y / MAP) * 100}% + 1.5px)`,
    width: `max(0px, calc(${(cell.w / MAP) * 100}% - 3px))`,
    height: `max(0px, calc(${(cell.h / MAP) * 100}% - 3px))`,
  }
}

export function BlockMosaic({
  cells,
  selectedHash,
  tone,
  blockNumber,
  switching,
  onPick,
}: {
  cells: Array<Cell>
  selectedHash: string | null
  tone: (gwei: number) => { color: string; ink: string }
  blockNumber: number | null
  switching: boolean
  onPick: (hash: string) => void
}) {
  const reduce = useReducedMotion()
  const selected = cells.find((cell) => cell.hash === selectedHash)
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        key={blockNumber}
        className="relative mt-3 aspect-square w-full overflow-hidden rounded-lg bg-background"
        initial={switching && !reduce ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
      >
        {cells.map((cell) => {
          const active = cell.hash === selectedHash
          const paint = tone(cell.feeGwei)
          const labeled =
            (cell.w > 56 && cell.h > 22) ||
            (active && cell.w > 36 && cell.h > 16)
          return (
            <button
              key={cell.hash}
              type="button"
              title={`${formatGwei(cell.feeGwei)} gwei · ${formatNumber(cell.gas)} gas`}
              aria-label={`${shortAddress(cell.hash)} ${formatGwei(cell.feeGwei)} gwei`}
              aria-pressed={active}
              onClick={() => onPick(cell.hash)}
              className={cn(
                'absolute overflow-hidden rounded-[3px] border-0 p-0 text-left outline-none hover:brightness-125',
                active && 'z-10',
              )}
              style={{
                ...tileFrame(cell),
                background: paint.color,
              }}
            >
              {labeled ? (
                <span
                  className="px-1.5 text-[11px] font-medium"
                  style={{ color: paint.ink }}
                >
                  {formatGwei(cell.feeGwei)}
                </span>
              ) : null}
            </button>
          )
        })}
        {selected ? (
          <PickRing cell={selected} ink={tone(selected.feeGwei).ink} />
        ) : null}
      </motion.div>
    </MotionConfig>
  )
}

function PickRing({
  cell,
  ink,
}: {
  cell: { x: number; y: number; w: number; h: number }
  ink: string
}) {
  const tight = cell.w < 48 || cell.h < 28
  return (
    <motion.div
      className="pointer-events-none absolute z-20 rounded-[3px]"
      initial={false}
      animate={{
        '--tile-x': (cell.x / MAP) * 100,
        '--tile-y': (cell.y / MAP) * 100,
        '--tile-w': (cell.w / MAP) * 100,
        '--tile-h': (cell.h / MAP) * 100,
        boxShadow: tight
          ? `inset 0 0 0 2px ${ink}, 0 0 0 3px ${ink}`
          : `inset 0 0 0 2px ${ink}`,
      }}
      style={{
        left: 'calc(var(--tile-x) * 1% + 1.5px)',
        top: 'calc(var(--tile-y) * 1% + 1.5px)',
        width: 'max(0px, calc(var(--tile-w) * 1% - 3px))',
        height: 'max(0px, calc(var(--tile-h) * 1% - 3px))',
      }}
      transition={{ type: 'spring', bounce: 0.18, duration: 0.45 }}
    />
  )
}
