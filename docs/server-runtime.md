# Server Runtime Guide

This guide documents the current Hono and Vite runtime used by VorzelaJs.

## Responsibilities

`server.ts` is responsible for:

- starting the HTTP server
- running Vite in middleware mode during development
- loading the server entry module
- serving built client assets in production
- rendering the HTML document on `GET *`
- exposing the route payload endpoint on `GET /__vorzela/payload`
- applying security headers
- moving to the next available port if the requested port is busy

## Development Runtime

In development, VorzelaJs creates a Vite server in middleware mode.

That means:

- the Hono app handles routing and document responses
- Vite provides module transforms and dev asset serving
- HMR is enabled through a websocket port
- route files are watched and `src/routeTree.gen.ts` is regenerated while the dev server keeps running

The HMR port is also probed for availability before startup.

## Production Runtime

In production, VorzelaJs reads `dist/client/.vite/manifest.json` to discover the built client entry and CSS files.

It then serves:

- `/assets/*` from `dist/client`
- `/favicon.svg` from `dist/client`
- `/robots.txt` from `dist/client`

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
- `Content-Security-Policy: ...`
- `Strict-Transport-Security` in production

## Payload Endpoint

The runtime exposes:

```text
GET /__vorzela/payload?path=/some-route
```

This endpoint is used by `server-payload` route mode and returns:

- merged head state
- matches
- pathname
- rendered leaf HTML
- status code

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