import { renderToStream, renderToString } from 'solid-js/web'

import { Document } from './document'
import type { RenderAssets, RoutePayloadEnvelope, SitemapEntry } from '../runtime'
import { renderResolvedMatches } from '../runtime'
import {
  getResolvedRouteStatus,
  resolveRoute,
  serializeRouteState,
} from '../runtime/resolve'
// @ts-expect-error resolved by vorzelajs vite plugin
import { routeManifest } from 'virtual:vorzela/routes'

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
  nonce,
}: {
  assets: RenderAssets
  nonce?: string
  request: Request
}) {
  const url = new URL(request.url)
  const state = await resolveRoute(`${url.pathname}${url.search}`, { request })
  const bootstrap = serializeRouteState(state)
  const status = getResolvedRouteStatus(state)

  const response = createStreamingResponse(() => renderToStream(() => (
    <Document assets={assets} bootstrap={bootstrap} head={state.head} nonce={nonce}>
      {renderResolvedMatches(state, { wrapHydrationBoundaries: true })}
    </Document>
  )), status)

  if (state.responseHeaders) {
    for (const [key, value] of state.responseHeaders) {
      response.headers.append(key, value)
    }
  }

  return response
}

export async function renderPayload({
  path,
  request,
}: {
  path: string
  request: Request
}): Promise<RoutePayloadEnvelope & { responseHeaders?: Headers }> {
  const state = await resolveRoute(path, { request })

  const html = renderToString(() => renderResolvedMatches(state, {
    wrapHydrationBoundaries: true,
  }))

  return {
    ...serializeRouteState(state),
    html,
    responseHeaders: state.responseHeaders,
    status: getResolvedRouteStatus(state),
  }
}

export async function getSitemapEntries(): Promise<SitemapEntry[]> {
  return routeManifest
    .filter((entry: { id: string; matchPath: string | null; to: string }) => entry.id !== '__root__' && entry.matchPath !== null && !entry.matchPath.includes('$'))
    .map((entry: { to: string }) => ({
      loc: entry.to,
    }))
}
