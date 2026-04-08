import { Link, createFileRoute } from '~/router'

export const Route = createFileRoute('/$')({
  head: () => ({
    meta: [
      {
        content: 'The requested VorzelaJs route could not be found.',
        name: 'description',
      },
    ],
    title: 'VorzelaJs | Not Found',
  }),
  component: NotFoundPage,
})

function NotFoundPage() {
  return (
    <section class="page-card page-card--centered">
      <p class="eyebrow">404</p>
      <h1>Route not found</h1>
      <p class="lead-copy">
        The generated route tree did not find a matching entry for this path.
      </p>
      <Link to="/" class="button button--primary">Back home</Link>
    </section>
  )
}