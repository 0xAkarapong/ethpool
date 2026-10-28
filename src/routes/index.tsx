import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Overview } from '@/components/overview'
import { useAutoRefresh, useReportHost } from '@/components/shell'
import { getOverview } from '@/lib/chain'
import type { OverviewData } from '@/lib/chain'

export const Route = createFileRoute('/')({
  loader: () => getOverview(),
  head: () => ({
    meta: [{ title: 'Overview · ETHPOOL' }],
  }),
  component: OverviewRoute,
})

function OverviewRoute() {
  const result = Route.useLoaderData()
  const router = useRouter()
  const [cached, setCached] = useState<OverviewData | null>(result.ok ? result : null)
  useReportHost(result.ok ? result.host : undefined)
  useAutoRefresh()

  useEffect(() => {
    if (result.ok) setCached(result)
  }, [result])

  return <Overview result={result} cached={cached} onRefresh={() => void router.invalidate()} />
}
