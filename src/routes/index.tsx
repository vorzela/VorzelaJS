import { createFileRoute,Link } from '~/router'

import { CounterCard } from '../components/counter-card.js'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      {
        content: 'Simple website example for VorzelaJs with Tailwind, local Inter, and a reusable counter component.',
        name: 'description',
      },
    ],
    title: 'VorzelaJs | Home',
  }),
  component: HomePage,
})

function HomePage() {
  return (
    <div class="space-y-8">
      <section class="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)]">
        <div class="rounded-4xl border border-white/10 bg-slate-900/75 px-7 py-8 shadow-2xl shadow-slate-950/30 backdrop-blur-xl sm:px-10 sm:py-10">
          <p class="text-xs font-semibold uppercase tracking-[0.28em] text-sky-300">Simple Website Example</p>
          <h1 class="mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">
            Routes are pages. Components are reusable UI.
          </h1>
          <p class="mt-5 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
            This example keeps page files in <span class="font-medium text-white">src/routes</span>,
            reusable UI in <span class="font-medium text-white">src/components</span>,
            and styling in Tailwind with a local Inter font.
          </p>

          <div class="mt-8 flex flex-wrap gap-3">
            <Link
              to="/about"
              class="inline-flex h-11 items-center justify-center rounded-full bg-sky-400 px-5 text-sm font-semibold text-slate-950 transition hover:-translate-y-0.5 hover:bg-sky-300"
            >
              Read the structure guide
            </Link>
            <Link
              to="/posts"
              class="inline-flex h-11 items-center justify-center rounded-full border border-white/10 bg-white/6 px-5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/10"
            >
              View blog posts
            </Link>
            <Link
              to="/filters"
              class="inline-flex h-11 items-center justify-center rounded-full border border-white/10 bg-white/6 px-5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/10"
            >
              Open filter demo
            </Link>
          </div>
        </div>

        <CounterCard />
      </section>

      <section class="grid gap-4 md:grid-cols-3">
        <article class="rounded-[1.75rem] border border-white/10 bg-white/6 p-6 shadow-xl shadow-slate-950/20 backdrop-blur-xl">
          <p class="text-sm font-semibold uppercase tracking-[0.24em] text-sky-300">Pages</p>
          <h2 class="mt-4 text-xl font-semibold text-white">Put screens in routes</h2>
          <p class="mt-3 text-sm leading-7 text-slate-300">
            Every file in <span class="font-medium text-slate-100">src/routes</span> owns a URL and exports a route definition.
          </p>
        </article>

        <article class="rounded-[1.75rem] border border-white/10 bg-white/6 p-6 shadow-xl shadow-slate-950/20 backdrop-blur-xl">
          <p class="text-sm font-semibold uppercase tracking-[0.24em] text-sky-300">Components</p>
          <h2 class="mt-4 text-xl font-semibold text-white">Put reusable UI in components</h2>
          <p class="mt-3 text-sm leading-7 text-slate-300">
            The counter card is a shared component imported by the home route, not a page living inside routes.
          </p>
        </article>

        <article class="rounded-[1.75rem] border border-white/10 bg-white/6 p-6 shadow-xl shadow-slate-950/20 backdrop-blur-xl">
          <p class="text-sm font-semibold uppercase tracking-[0.24em] text-sky-300">Framework Core</p>
          <h2 class="mt-4 text-xl font-semibold text-white">Hide the internals when app-building</h2>
          <p class="mt-3 text-sm leading-7 text-slate-300">
            Use the included app-focused VS Code explorer settings if you want to keep framework files out of the way.
          </p>
        </article>
      </section>

      <section class="rounded-4xl border border-white/10 bg-slate-900/75 px-7 py-8 shadow-2xl shadow-slate-950/30 backdrop-blur-xl sm:px-10">
        <p class="text-xs font-semibold uppercase tracking-[0.28em] text-sky-300">Kept for Framework Demos</p>
        <div class="mt-4 flex flex-wrap gap-3">
          <Link to="/login" class="inline-flex h-10 items-center justify-center rounded-full border border-white/10 bg-white/6 px-4 text-sm font-medium text-slate-200 transition hover:bg-white/10">
            Pathless route
          </Link>
          <Link to="/errors/loader" class="inline-flex h-10 items-center justify-center rounded-full border border-white/10 bg-white/6 px-4 text-sm font-medium text-slate-200 transition hover:bg-white/10">
            Loader error
          </Link>
          <Link to="/errors/render" class="inline-flex h-10 items-center justify-center rounded-full border border-white/10 bg-white/6 px-4 text-sm font-medium text-slate-200 transition hover:bg-white/10">
            Render error
          </Link>
        </div>
      </section>
    </div>
  )
}