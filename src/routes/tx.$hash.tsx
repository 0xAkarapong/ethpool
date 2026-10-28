import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useAutoRefresh, useReportHost } from '@/components/shell'
import { TxFlow } from '@/components/tx-flow'
import { getTxFlow } from '@/lib/chain'

export const Route = createFileRoute('/tx/$hash')({
  loader: ({ params }) => getTxFlow({ data: params.hash }),
  head: () => ({
    meta: [{ title: 'Transaction · ETHPOOL' }],
  }),
  component: TxRoute,
})

function TxRoute() {
  const result = Route.useLoaderData()
  const router = useRouter()
  useReportHost(result.ok ? result.host : undefined)
  useAutoRefresh()
  return <TxFlow result={result} onRefresh={() => void router.invalidate()} />
}
