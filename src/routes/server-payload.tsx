import { createFileRoute } from '~/router'
import type { RouteComponentProps } from '~/router'

type ServerPayloadData = {
  generatedAt: string
}

export const Route = createFileRoute('/server-payload')<ServerPayloadData>({
  head: ({ loaderData }) => ({
    meta: [
      {
        content: `Server payload route rendered at ${loaderData.generatedAt}.`,
        name: 'description',
      },
    ],
    title: 'VorzelaJs | Server Payload',
  }),
  loader: async () => ({
    generatedAt: new Date().toISOString(),
  }),
  mode: 'server-payload',
  component: ServerPayloadRoute,
})

function ServerPayloadRoute(
  props: RouteComponentProps<'/server-payload', ServerPayloadData>,
) {
  return (
    <section class="page-card">
      <p class="eyebrow">Hybrid Route</p>
      <h1>Server payload transition</h1>
      <p class="lead-copy">
        This route stays inside the client shell, but the leaf content is refreshed from the
        server when you navigate here.
      </p>
      <dl class="fact-grid">
        <div>
          <dt>Rendered at</dt>
          <dd>{props.loaderData.generatedAt}</dd>
        </div>
      </dl>
    </section>
  )
}