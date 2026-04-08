import { renderToStream, renderToString } from 'solid-js/web'

import { Document } from './document'
import { renderResolvedMatches } from './router'
import {
  getResolvedRouteStatus,
  resolveRoute,
  serializeRouteState,
} from './router/resolve'

import type { RenderAssets, RoutePayloadEnvelope } from './router'

function createStreamingResponse(bodyFactory: () => ReturnType<typeof renderToStream>, status = 200) {
  const encoder = new TextEncoder()

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode('<!DOCTYPE html>'))

      const stream = bodyFactory()

      try {
        await stream.pipeTo(new WritableStream<string | Uint8Array>({
          write(chunk) {
            controller.enqueue(typeof chunk === 'string' ? encoder.encode(chunk) : chunk)
          },
          close() {
            controller.close()
          },
          abort(reason) {
            controller.error(reason)
          },
        }))
      } catch (error) {
        controller.error(error)
      }
    },
  })

  return new Response(body, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
    status,
  })
}

export async function renderDocument({
  request,
  assets,
}: {
  assets: RenderAssets
  request: Request
}) {
  const url = new URL(request.url)
  const state = await resolveRoute(`${url.pathname}${url.search}`, { request })
  const bootstrap = serializeRouteState(state)
  const status = getResolvedRouteStatus(state)

  return createStreamingResponse(() => renderToStream(() => (
    <Document assets={assets} bootstrap={bootstrap} head={state.head}>
      {renderResolvedMatches(state)}
    </Document>
  )), status)
}

export async function renderPayload({
  path,
  request,
}: {
  path: string
  request: Request
}): Promise<RoutePayloadEnvelope> {
  const state = await resolveRoute(path, { request })

  const html = renderToString(() => renderResolvedMatches({
    matches: state.matches.slice(1),
    notFound: state.notFound,
    renderSource: 'component',
    routeError: state.routeError,
  }))

  return {
    ...serializeRouteState(state),
    html,
    status: getResolvedRouteStatus(state),
  }
}