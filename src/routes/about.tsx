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
    <section class="page-card">
      <p class="eyebrow">About</p>
      <h1>Built to own the runtime</h1>
      <p class="lead-copy">
        This route is rendered through VorzelaJs itself. Client navigation keeps the shell
        mounted and swaps only the routed content.
      </p>
    </section>
  )
}