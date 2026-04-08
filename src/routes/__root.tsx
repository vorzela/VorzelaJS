import { Link, Outlet, createRootRoute } from '~/router'

export const Route = createRootRoute()({
  head: () => ({
    links: [
      { href: '/favicon.svg', rel: 'icon', type: 'image/svg+xml' },
    ],
    meta: [
      {
        content: 'VorzelaJs is a custom SolidJS framework with streamed SSR, client navigation, and generated file routes.',
        name: 'description',
      },
      { content: 'index,follow', name: 'robots' },
      { content: '#09111f', name: 'theme-color' },
      { content: 'VorzelaJs', property: 'og:title' },
      {
        content: 'A SolidJS + Hono framework core with streamed SSR, CSR navigation, and generated route trees.',
        property: 'og:description',
      },
      { content: 'website', property: 'og:type' },
    ],
    title: 'VorzelaJs',
  }),
  component: RootLayout,
  notFoundComponent: RootNotFound,
})

function RootLayout() {
  return (
    <div class="app-shell">
      <header class="site-header">
        <div class="site-header__inner">
          <Link to="/" class="brand-mark">VorzelaJs</Link>
          <nav class="site-nav" aria-label="Primary navigation">
            <Link to="/about" class="site-nav__link">About</Link>
            <Link to="/posts" class="site-nav__link">Posts</Link>
            <Link to="/server-payload" class="site-nav__link">Server Payload</Link>
          </nav>
        </div>
      </header>

      <main class="site-main">
        <Outlet />
      </main>
    </div>
  )
}

function RootNotFound() {
  return (
    <div class="page-card page-card--centered">
      <p class="eyebrow">404</p>
      <h1>Page not found</h1>
      <p class="lead-copy">The generated route tree could not resolve this content.</p>
    </div>
  )
}