import { createFileRoute, useRouter } from '@tanstack/react-router'
import { AddressView } from '@/components/address-view'
import { useAutoRefresh, useReportHost, useStickyOk } from '@/components/shell'
import { getAddressView } from '@/lib/chain'

export const Route = createFileRoute('/address/$address')({
  loader: ({ params }) => getAddressView({ data: params.address }),
  head: ({ params }) => ({
    meta: [{ title: `Address ${params.address} · ETHPOOL` }],
  }),
  component: AddressRoute,
})

function AddressRoute() {
  const { address } = Route.useParams()
  const result = Route.useLoaderData()
  const router = useRouter()
  const cached = useStickyOk(address, result)
  useReportHost(result.ok ? result.host : undefined)
  useAutoRefresh()
  return (
    <AddressView
      address={address}
      result={result}
      cached={cached}
      onRefresh={() => void router.invalidate()}
    />
  )
}
