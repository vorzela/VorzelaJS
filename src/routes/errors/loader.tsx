import { createFileRoute } from '~/router'
import type { RouteErrorContext } from '~/router'

export const Route = createFileRoute('/errors/loader')({
  head: () => ({
    meta: [
      {
        content: 'Demonstrates loader failure rendering through a route-specific error component.',
        name: 'description',
      },
    ],
    title: 'VorzelaJs | Loader Error Demo',
  }),
  loader: async () => {
    throw new Error('The loader failed, but the surrounding layout stays mounted.')
  },
  errorComponent: LoaderErrorFallback,
  component: LoaderErrorPage,
})

function LoaderErrorPage() {
  return null
}

function LoaderErrorFallback(props: RouteErrorContext) {
  return (
    <section class="page-card page-card--centered">
      <p class="eyebrow">{props.error.status}</p>
      <h1>Loader error fallback</h1>
      <p class="lead-copy">{props.error.message}</p>
      <button type="button" class="button button--primary" onClick={props.reset}>
        Retry loader
      </button>
    </section>
  )
}