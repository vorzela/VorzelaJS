# SSR Guide

This guide documents the current VorzelaJs server rendering model.

## Rendering Pipeline

The initial document request flows like this:

1. `server.ts` receives the request through Hono
2. the runtime loads `src/entry-server.tsx`
3. `resolveRoute()` builds the route state for the request pathname
4. `renderDocument()` streams a full HTML document through `renderToStream`
5. the document includes the bootstrap payload and client entry script

## Full Document Rendering

VorzelaJs does not render into an `index.html` shell template.

Instead, the server returns a full HTML document from `src/document.tsx`.

That document contains:

- route head metadata
- canonical links and JSON-LD scripts
- `HydrationScript`
- linked CSS assets
- rendered route HTML inside `#app`
- a JSON bootstrap payload in `#__VORZELA_DATA__`
- module scripts for the client bundle

In production, the hydration script, bootstrap payload script, module scripts, and JSON-LD scripts all receive the per-request CSP nonce.

The bootstrap payload is also escaped for `&`, `<`, `>`, `\u2028`, and `\u2029` before injection into the document.

## Streaming SSR

The initial HTML response is streamed through `renderToStream` in `src/entry-server.tsx`.

The response starts with `<!DOCTYPE html>` and then streams the rendered Solid document into a `ReadableStream`.

This means VorzelaJs supports streamed document delivery.

## Hydration Model

The current hydration model is route-branch islands with delegated navigation.

`src/entry-client.tsx` now does this:

```tsx
const router = createRouter(readBootstrapPayload())
await router.init()
```

During `init()`, the router:

- commits the bootstrap route state
- installs same-origin delegated navigation and `popstate` handling
- swaps server-rendered HTML into `#app` on navigation
- hydrates only the matched route branches marked as `client`

SSR emits island roots as `data-vrz-island-root` markers.

Route hydration is determined during route generation by scanning each route module and its local imports for interactive client primitives such as event handlers, navigation hooks, or Solid client hooks.

Current granularity is route-branch level, not arbitrary nested component extraction.

So the correct status is:

- streamed SSR: yes
- route-branch island hydration: yes
- arbitrary nested component islands: no

## Bootstrap Payload

The document embeds serialized route state in:

```html
<script id="__VORZELA_DATA__" type="application/json">...</script>
```

The client reads that payload through `readBootstrapPayload()`.

The payload currently includes:

- merged head data
- serialized matches, including hydration metadata per match
- pathname
- optional not-found state
- optional route error state

## Payload Navigation

Client-side navigations now use the payload endpoint for same-origin route transitions.

Payload requests are sent with `X-Vorzela-Navigation: payload`. In production, the server rejects payload requests that do not present a same-host `Origin` or `Referer`.

Flow:

1. the client requests `/__vorzela/payload?path=...`
2. the server resolves the route and renders the full routed HTML with island markers
3. the client swaps that HTML into `#app`
4. the client syncs head metadata and hydrates only the matched `client` branches

This is partial hydration at route-branch granularity, not leaf-only HTML injection.

## Route Response Headers

`beforeLoad` and `loader` receive a mutable `response` stub.

Today the runtime forwards `response.headers` through both streamed document responses and payload responses. That is how route-level `Set-Cookie` headers work during initial SSR and later client navigations.

## Server-Only Helpers

When a route needs Node-only code such as database drivers, `node:fs`, or `node:crypto`,
put that code in a colocated `.server` helper and call it from `loader`, `beforeLoad`,
or `validateSearch`.

Example:

```tsx
import { createFileRoute } from '~/router'

import { readArticle } from './article.server'

export const Route = createFileRoute('/articles/$articleId')({
	loader: ({ params }) => readArticle(params.articleId),
	component: ArticlePage,
})
```

Build behavior:

- `.server` files under `src/routes` are ignored by route generation
- the client build strips `loader`, `beforeLoad`, and `validateSearch` from route modules
- matching `.server` imports used only by those server-only route hooks are removed from the client bundle
- using a `.server` import from route component code or other client-visible modules fails the build

## Status Codes

Current SSR status handling:

- normal route: `200`
- `notFound()` or catch-all state: `404`
- `beforeLoad` / `loader` route failures: `500` with route-scoped fallback UI
- redirect: redirect response from the server
- unexpected server error: generic `500`

## Error Boundary Research Result

Automatic route-scoped error rendering is implemented today.

What exists:

- `redirect()` handling
- `notFound()` handling
- route-scoped `errorComponent` rendering for `beforeLoad` and `loader` failures
- automatic route-scoped render fallbacks through Solid `ErrorBoundary`
- generic `500` responses from server catches when the runtime itself fails

What does not exist:

- typed `400`, `401`, `403`, `422`, `500` boundary APIs
- structured status helper constructors such as `badRequest()` or `internalServerError()`

So the current state is:

- route-scoped error UI: yes
- custom route error components: yes
- structured status-aware error API families: no

## Practical Summary

Current SSR capability matrix:

- full HTML document SSR: yes
- streamed initial response: yes
- payload-driven route navigation: yes
- route-branch island hydration: yes
- arbitrary nested component islands: no
- route-scoped error rendering: yes