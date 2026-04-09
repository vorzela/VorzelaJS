import type { RouteComponentProps } from '~/router'
import { createFileRoute } from '~/router'

import type { ServerPayloadData } from './server-payload.server.js'
import { getServerPayloadData } from './server-payload.server.js'

export const Route = createFileRoute('/server-payload')<ServerPayloadData>({
  head: ({ loaderData }) => ({
    meta: [
      {
        content: `Server payload route rendered at ${loaderData.generatedAt} with a colocated .server helper.`,
        name: 'description',
      },
    ],
    title: 'VorzelaJs | Server Payload',
  }),
  loader: () => getServerPayloadData(),
  component: ServerPayloadRoute,
})

function ServerPayloadRoute(
  props: RouteComponentProps<'/server-payload', ServerPayloadData>,
) {
  return (
    <section class="page-card">
      <p class="eyebrow">Payload Route</p>
      <h1>.server helper example</h1>
      <p class="lead-copy">
        This route imports a colocated <code>.server</code> helper from
        <code> src/routes/server-payload.server.ts</code>. That helper can safely use
        Node-only packages because the client build strips loader code and the matching
        <code>.server</code> import.
      </p>
      <dl class="fact-grid">
        <div>
          <dt>Rendered at</dt>
          <dd>{props.loaderData.generatedAt}</dd>
        </div>
        <div>
          <dt>Helper file</dt>
          <dd>{props.loaderData.helperPath}</dd>
        </div>
        <div>
          <dt>Node-only signature</dt>
          <dd>{props.loaderData.signature}</dd>
        </div>
      </dl>
    </section>
  )
}