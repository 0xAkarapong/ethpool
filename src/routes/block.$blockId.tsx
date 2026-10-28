import { createFileRoute, useRouter } from '@tanstack/react-router'
import { BlockMap } from '@/components/block-map'
import { useAutoRefresh, useReportHost } from '@/components/shell'
import { getBlockView } from '@/lib/chain'

export const Route = createFileRoute('/block/$blockId')({
  loader: ({ params }) => getBlockView({ data: params.blockId }),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.ok ? `Block ${loaderData.block.number.toLocaleString('en-US')} · ETHPOOL` : 'Block · ETHPOOL',
      },
    ],
  }),
  component: BlockRoute,
})

function BlockRoute() {
  const result = Route.useLoaderData()
  const router = useRouter()
  useReportHost(result.ok ? result.host : undefined)
  useAutoRefresh()
  return <BlockMap result={result} onRefresh={() => void router.invalidate()} />
}
