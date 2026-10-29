import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useAutoRefresh, useReportHost, useStickyOk } from '@/components/shell'
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
  const { hash } = Route.useParams()
  const result = Route.useLoaderData()
  const router = useRouter()
  const cached = useStickyOk(hash, result)
  useReportHost(result.ok ? result.host : undefined)
  useAutoRefresh()
  return (
    <TxFlow
      result={result}
      cached={cached}
      onRefresh={() => void router.invalidate()}
    />
  )
}
