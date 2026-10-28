import { createFileRoute } from '@tanstack/react-router'
import { AddressList } from '@/components/address-view'

export const Route = createFileRoute('/trace')({
  head: () => ({
    meta: [{ title: 'Addresses · ETHPOOL' }],
  }),
  component: AddressList,
})
