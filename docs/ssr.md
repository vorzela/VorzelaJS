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
- `HydrationScript`
- linked CSS assets
- rendered route HTML inside `#app`
- a JSON bootstrap payload in `#__VORZELA_DATA__`
- module scripts for the client bundle

## Streaming SSR

The initial HTML response is streamed through `renderToStream` in `src/entry-server.tsx`.

The response starts with `<!DOCTYPE html>` and then streams the rendered Solid document into a `ReadableStream`.

This means VorzelaJs supports streamed document delivery.

## Hydration Model

The current hydration model is full-app hydration.

`src/entry-client.tsx` does this:

```tsx
const router = createRouter(readBootstrapPayload())
await router.init()

hydrate(() => <RouterProvider router={router} />, document.getElementById('app')!)
```

That means the application hydrates the routed app tree under `#app` as one Solid application.

## Partial Hydration Research Result

Partial hydration is not implemented today.

Reasons from the codebase:

- there is a single `hydrate()` call for the entire app root
- there is no island boundary system
- there is no component-level hydration scheduler
- there is no resumability or progressive client activation layer

So the correct status is:

- streamed SSR: yes
- full hydration: yes
- partial hydration / islands: no

## Bootstrap Payload

The document embeds serialized route state in:

```html
<script id="__VORZELA_DATA__" type="application/json">...</script>
```

The client reads that payload through `readBootstrapPayload()`.

The payload currently includes:

- merged head data
- serialized matches
- pathname
- optional not-found state
- optional route error state

## Payload Route Mode

Routes with `mode: 'server-payload'` use a hybrid transition path.

Flow:

1. the client resolves the route as usual
2. if the leaf route mode is `server-payload`, the client requests `/__vorzela/payload?path=...`
3. the server renders the leaf route HTML with `renderPayload()`
4. the client injects that payload HTML into the routed outlet area

This is not the same as partial hydration.

It is a server-refreshed leaf rendering mode inside an already hydrated shell.

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
- client hydration: yes
- server payload leaf rendering: yes
- partial hydration: no
- route-scoped error rendering: yes