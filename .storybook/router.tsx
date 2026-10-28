import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'

const StoryBody = createContext<ReactNode>(null)

const rootRoute = createRootRoute({
  component: function StoryRoot() {
    return useContext(StoryBody)
  },
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => null,
})

const blockRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/block/$blockId',
  component: () => null,
})

const txRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tx/$hash',
  component: () => null,
})

const addressRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/address/$address',
  component: () => null,
})

const traceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/trace',
  component: () => null,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  blockRoute,
  txRoute,
  addressRoute,
  traceRoute,
])

export function WithRouter({
  children,
  storyId,
}: {
  children: ReactNode
  storyId: string
}) {
  const router = useMemo(
    () =>
      createRouter({
        routeTree,
        history: createMemoryHistory({ initialEntries: ['/'] }),
        defaultPreload: false,
      }),
    [storyId],
  )

  return (
    <StoryBody.Provider value={children}>
      <RouterProvider router={router} />
    </StoryBody.Provider>
  )
}
