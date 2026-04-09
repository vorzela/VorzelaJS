# Server Runtime Guide

This guide documents the current Hono and Vite runtime used by VorzelaJs.

## Responsibilities

`server.ts` is responsible for:

- starting the HTTP server
- running Vite in middleware mode during development
- loading the server entry module
- serving built client assets in production
- rendering the HTML document on `GET *`
- exposing the optional analytics endpoint on `OPTIONS|POST /__vorzela/analytics`
- exposing `GET /robots.txt`
- exposing `GET /sitemap.xml`
- exposing the route payload endpoint on `GET /__vorzela/payload`
- generating a per-request CSP nonce for document scripts
- forwarding route response headers from SSR and payload rendering
- applying security headers
- moving to the next available port if the requested port is busy

## Development Runtime

In development, VorzelaJs creates a Vite server in middleware mode.

That means:

- the Hono app handles routing and document responses
- Vite provides module transforms and dev asset serving
- HMR is enabled through a websocket port
- route and source files that affect hydration analysis are watched while the dev server keeps running
- `src/routeTree.gen.ts` and `src/routeHydration.gen.ts` are regenerated without restarting the server

The HMR port is also probed for availability before startup.

## Production Runtime

In production, VorzelaJs reads `dist/client/.vite/manifest.json` to discover the built client entry and CSS files.

The runtime collects the entry JavaScript plus the built CSS asset set so the document can link styles up front.

It then serves:

- `/assets/*` from `dist/client`
- `/favicon.svg` from `dist/client`

The SSR entry is loaded from:

```text
dist/server/entry-server.js
```

## Commands

### Development

```bash
npm run dev
```

### Production Build

```bash
npm run build
```

### Production Serve

```bash
npm run serve
```

## Port Fallback

VorzelaJs now probes ports instead of failing immediately on `EADDRINUSE`.

App server behavior:

- default port is `3080`
- if busy, try `3081`, then `3082`, and so on

HMR behavior:

- default HMR port is `24678`
- if busy, try the next port until an open one is found

Environment variables:

- `PORT`
- `VORZELA_HMR_PORT`

## SSR Entry Loading

The runtime loads the server entry differently by environment:

- development: `vite.ssrLoadModule('/src/entry-server.tsx')`
- production: `import('./dist/server/entry-server.js')`

## Security Headers

The server currently applies these headers to all responses:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Resource-Policy: same-origin`
- `Permissions-Policy: ...`
- `X-Robots-Tag: index, follow, ...`
- `Content-Security-Policy: ...`
- `Strict-Transport-Security` in production

In production, the CSP uses a per-request nonce instead of `unsafe-inline`. That nonce is passed into `src/document.tsx` and applied to the hydration script, bootstrap JSON, JSON-LD scripts, and module scripts.

## Robots and Sitemap

The runtime exposes:

```text
GET /robots.txt
GET /sitemap.xml
```

Current behavior:

- `robots.txt` is generated dynamically from `entry.robotsConfig` when exported, otherwise from `defaultRobotsConfig()`
- the default robots config allows normal crawlers, blocks known AI training crawlers, and can advertise `sitemap.xml`
- `sitemap.xml` is generated from `entry.getSitemapEntries()` when exported
- the default `src/entry-server.tsx` implementation builds sitemap entries from generated non-dynamic routes and skips `$` params
- `public/robots.txt` is no longer required for the built-in runtime

## Document Responses

`src/entry-server.tsx` resolves the route, streams the HTML document, and appends any headers written to `response.headers` during route resolution.

This is how `Set-Cookie` and other route-level headers reach the browser on the initial SSR response.

## Payload Endpoint

The runtime exposes:

```text
GET /__vorzela/payload?path=/some-route
```

This endpoint is used by same-origin client route transitions and returns:

- merged head state
- matches with hydration metadata
- pathname
- search
- rendered route HTML
- status code

Client-side navigation in the current islands runtime also uses this endpoint for same-origin route transitions. Redirects are returned as JSON redirect envelopes so the client router can follow them without requesting a full document first.

Current payload protections and behavior:

- clients must send `X-Vorzela-Navigation: payload`
- in production, payload requests must present a same-host `Origin` or `Referer`
- payload responses are `no-store`
- headers written to `response.headers` during route resolution are appended to the payload response
- redirects become JSON `{ redirect: { to, status, replace } }` envelopes instead of HTTP redirects

## Analytics Endpoint

When `src/entry-server.tsx` exports an `analytics` definition via `defineAnalytics(...)` from `~/router/server`, the server runtime also exposes:

```text
OPTIONS /__vorzela/analytics
POST /__vorzela/analytics
```

This endpoint is intended for first-party analytics and attribution collection.

Current behavior:

- accepts small JSON event payloads from the browser client
- can set a first-party visitor cookie on the response
- classifies traffic from UTM parameters, click IDs, and referrer data
- can be restricted with `allowedOrigins`
- writes CORS headers for allowed origins
- returns `204` on success

If no analytics definition is exported, the endpoint returns `404`.

## Runtime Error Handling

Current runtime behavior:

- redirect signals become redirect responses
- not-found states become `404`
- route-scoped `beforeLoad` and `loader` failures render fallback UI with `500` status
- route component render failures are contained by route-scoped boundaries instead of collapsing the whole shell
- unexpected payload endpoint failures return JSON `500`
- unexpected document failures return text `500`

There is route-scoped application error rendering now, but there is still no structured status-helper API layer.

## What Is Missing

The current server runtime does not yet provide:

- typed server action handling
- middleware-based auth framework APIs
- structured typed error helpers per status code class
- request-scoped framework context injection beyond the current route resolution inputs