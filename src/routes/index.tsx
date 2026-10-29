import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Overview } from '@/components/overview'
import { useAutoRefresh, useReportHost, useStickyOk } from '@/components/shell'
import { getOverview } from '@/lib/chain'

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
  const cached = useStickyOk('overview', result)
  useReportHost(result.ok ? result.host : undefined)
  useAutoRefresh()

  return (
    <Overview
      result={result}
      cached={cached}
      onRefresh={() => void router.invalidate()}
    />
  )
}
