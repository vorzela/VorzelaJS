import { createRootRoute, Link, Outlet } from 'vorzelajs'

export const Route = createRootRoute({
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
      <Link to="/" class="link">
        Go home
      </Link>
    </div>
  ),
})

function RootLayout() {
  return (
    <div class="app">
      <header class="header">
        <nav class="nav">
          <Link to="/" class="nav-brand">
            VorzelaJs
          </Link>
          <div class="nav-links">
            <Link to="/" class="nav-link">
              Home
            </Link>
            <Link to="/about" class="nav-link">
              About
            </Link>
          </div>
        </nav>
      </header>
      <Outlet />
    </div>
  )
}
