import { createRootRoute,Link, Outlet } from '~/router'

export const Route = createRootRoute()({
  head: () => ({
    links: [
      { href: '/favicon.svg', rel: 'icon', type: 'image/svg+xml' },
    ],
    meta: [
      {
        content: 'VorzelaJs is a custom SolidJS framework with streamed SSR, route islands, Tailwind styling, and file-based routes.',
        name: 'description',
      },
      { content: 'index,follow', name: 'robots' },
      { content: '#09111f', name: 'theme-color' },
      { content: 'VorzelaJs', property: 'og:title' },
      {
        content: 'A SolidJS + Hono framework core with streamed SSR, payload navigation, and generated route trees.',
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
    <div class="min-h-screen">
      <header class="sticky top-0 z-30 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <div class="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <Link to="/" class="text-sm font-semibold uppercase tracking-[0.3em] text-sky-300">
              VorzelaJs
            </Link>
            <p class="mt-2 text-sm text-slate-400">
              App code stays in <span class="font-medium text-slate-200">src/routes</span>,
              {' '}<span class="font-medium text-slate-200">src/components</span>,
              {' '}<span class="font-medium text-slate-200">src/lib</span>, and
              {' '}<span class="font-medium text-slate-200">src/contexts</span>.
            </p>
          </div>

          <nav class="flex flex-wrap gap-2" aria-label="Primary navigation">
            <Link to="/" class="inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium text-slate-300 transition hover:bg-white/8 hover:text-white">
              Home
            </Link>
            <Link to="/about" class="inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium text-slate-300 transition hover:bg-white/8 hover:text-white">
              About
            </Link>
            <Link to="/posts" class="inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium text-slate-300 transition hover:bg-white/8 hover:text-white">
              Posts
            </Link>
            <Link to="/filters" class="inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium text-slate-300 transition hover:bg-white/8 hover:text-white">
              Filters
            </Link>
          </nav>
        </div>
      </header>

      <main class="mx-auto w-full max-w-6xl px-4 pb-20 pt-10 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  )
}

function RootNotFound() {
  return (
    <section class="mx-auto max-w-3xl rounded-4xl border border-white/10 bg-slate-900/75 px-8 py-12 text-center shadow-2xl shadow-slate-950/30 backdrop-blur-xl">
      <p class="text-xs font-semibold uppercase tracking-[0.28em] text-sky-300">404</p>
      <h1 class="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">Page not found</h1>
      <p class="mt-4 text-base leading-8 text-slate-300">
        The generated route tree could not resolve this content.
      </p>
    </section>
  )
}