import { createRootRoute, Outlet } from 'vorzelajs'

export const Route = createRootRoute()({
  component: RootLayout,
  head: () => ({
    meta: [
      { name: 'description', content: 'Built with VorzelaJs' },
    ],
  }),
  notFoundComponent: () => (
    <div class="not-found">
      <h1>404</h1>
      <p>Page not found</p>
    </div>
  ),
})

function RootLayout() {
  return (
    <div class="app">
      <Outlet />
    </div>
  )
}
