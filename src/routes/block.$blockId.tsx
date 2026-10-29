import { createFileRoute, useRouter } from '@tanstack/react-router'
import { BlockMap } from '@/components/block-map'
import { useAutoRefresh, useReportHost, useStickyOk } from '@/components/shell'
import { getBlockView } from '@/lib/chain'

export const Route = createFileRoute('/block/$blockId')({
  loader: ({ params }) => getBlockView({ data: params.blockId }),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.ok
          ? `Block ${loaderData.block.number.toLocaleString('en-US')} · ETHPOOL`
          : 'Block · ETHPOOL',
      },
    ],
  }),
  component: BlockRoute,
})

function BlockRoute() {
  const { blockId } = Route.useParams()
  const result = Route.useLoaderData()
  const router = useRouter()
  const cached = useStickyOk(blockId, result)
  useReportHost(result.ok ? result.host : undefined)
  useAutoRefresh()
  return (
    <BlockMap
      result={result}
      cached={cached}
      onRefresh={() => void router.invalidate()}
    />
  )
}
