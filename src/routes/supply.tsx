import { createFileRoute, useRouter } from '@tanstack/react-router'
import { SupplyView } from '@/components/supply-view'
import { useAutoRefresh, useStickyOk } from '@/components/shell'
import { getSupply } from '@/lib/chain'
import type { SupplyData } from '@/lib/supply'

export const Route = createFileRoute('/supply')({
  loader: () => getSupply(),
  head: () => ({
    meta: [{ title: 'Supply · ETHPOOL' }],
  }),
  component: SupplyRoute,
})

function SupplyRoute() {
  const result = Route.useLoaderData()
  const router = useRouter()
  const cached = useStickyOk<SupplyData>('supply', result)
  useAutoRefresh()

  return (
    <SupplyView
      result={result}
      cached={cached}
      onRefresh={() => void router.invalidate()}
    />
  )
}
