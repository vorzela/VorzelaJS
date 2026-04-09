import { createFileRoute } from '~/router'

export const Route = createFileRoute('/about')({
  head: () => ({
    meta: [
      {
        content: 'About the VorzelaJs framework runtime and why it is being built.',
        name: 'description',
      },
    ],
    title: 'VorzelaJs | About',
  }),
  component: AboutPage,
})

function AboutPage() {
  return (
    <section class="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.95fr)]">
      <article class="rounded-4xl border border-white/10 bg-slate-900/75 px-7 py-8 shadow-2xl shadow-slate-950/30 backdrop-blur-xl sm:px-10">
        <p class="text-xs font-semibold uppercase tracking-[0.28em] text-sky-300">About the App Structure</p>
        <h1 class="mt-5 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Keep the app in <span class="text-sky-300">src</span>. Keep the framework out of the way.
        </h1>
        <p class="mt-5 text-base leading-8 text-slate-300">
          Big frameworks hide their runtime because application authors should mostly think about pages,
          components, state, utilities, and content. This repo still contains framework internals because
          it is the framework source itself, but the app-facing layout should still feel familiar.
        </p>
      </article>

      <article class="rounded-4xl border border-white/10 bg-white/6 p-6 shadow-xl shadow-slate-950/20 backdrop-blur-xl">
        <p class="text-sm font-semibold uppercase tracking-[0.24em] text-sky-300">Recommended App Folders</p>
        <pre class="mt-4 overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm leading-7 text-slate-200">src/
  routes/
  components/
  lib/
  contexts/
  styles.css</pre>
        <p class="mt-4 text-sm leading-7 text-slate-300">
          In this repo, <span class="font-medium text-slate-100">src/router</span>,
          {' '}<span class="font-medium text-slate-100">src/entry-client.tsx</span>,
          {' '}<span class="font-medium text-slate-100">src/entry-server.tsx</span>, and
          {' '}<span class="font-medium text-slate-100">server.ts</span> are framework internals.
        </p>
      </article>
    </section>
  )
}