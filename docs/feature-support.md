# Feature Support Research

This document answers the framework capability questions against the current VorzelaJs implementation, not against the intended roadmap.

## Research Method

This assessment is based on the current source code in:

- `scripts/generate-routes.ts`
- `src/router/index.tsx`
- `src/router/types.ts`
- `src/router/runtime.tsx`
- `src/router/resolve.ts`
- `src/entry-client.tsx`
- `src/entry-server.tsx`
- `server.ts`

## Support Matrix

| Capability | Status | Notes |
|---|---|---|
| File-based routing | Yes | Implemented through `scripts/generate-routes.ts` |
| Dynamic params with `$param` | Yes | Implemented in path matching and route param typing |
| Catch-all route with `$.tsx` | Yes | Implemented |
| Query-string preservation in navigation | Yes | Search params are preserved in SSR, hydration, and client navigation |
| `validateSearch` | Yes | Implemented with serialized validated search state |
| `setSearch()` merging | Yes | Implemented through router and hook helpers |
| Object-based `navigate({ to, search })` | Yes | Implemented for explicit path plus search navigation |
| `filterSearch` helper | Yes | Implemented for arrays, booleans, sort, page, and text filters |
| `beforeLoad` | Yes | Implemented in route resolution |
| `afterLoad` | Yes | Implemented as a client-only post-hydration route callback |
| `loader` | Yes | Implemented |
| Colocated `.server` helpers for route hooks | Yes | `.server` files are ignored as routes and can be imported from `loader`, `beforeLoad`, and `validateSearch` |
| `head` | Yes | Implemented |
| `notFound()` / `notFoundComponent` | Yes | Implemented with 404 status |
| `redirect()` | Yes | Implemented on server and client |
| `errorComponent` | Yes | Implemented for route-scoped loader and render failures |
| Canonical links and JSON-LD head fields | Yes | Implemented in `src/document.tsx` and `src/router/head.ts` |
| Streamed SSR | Yes | Implemented in `src/entry-server.tsx` |
| Full-app hydration | No | Replaced by delegated navigation plus route-branch island hydration |
| Payload-driven same-origin navigation | Yes | Implemented through `/__vorzela/payload` |
| `_guest` or `_protected` ignored from URL | Yes | Underscore-prefixed files and folders are pathless |
| Route groups | Yes, limited | Supported for underscore-only pathless files and folders |
| Partial hydration / islands | Yes, limited | Automatic route-branch islands; no arbitrary nested component extraction |
| Generated `robots.txt` and `sitemap.xml` | Yes, limited | Built-in runtime serves both; default sitemap skips dynamic `$` routes |
| Route-level error boundaries | Yes, limited | Automatic route-scoped fallbacks exist; typed status helpers do not |
| PWA support | Yes, opt-in | Service worker, manifest, offline fallback via `pwa: true` in Vite config |
| Structured 400/401/403/422/500 page framework | No | Only `404` and generic `500` handling exist |

## `_` Files Research Result

The generator now strips underscore-prefixed path segments from the URL path while preserving distinct internal route ids.

Current generator logic:

- special-cases only `__root`
- special-cases `index`
- treats underscore-prefixed files as pathless routes
- treats underscore-prefixed directories as pathless grouping folders

Therefore:

- `_guest.tsx` becomes a pathless route with internal id `/_guest`
- `_guest/login.tsx` resolves to `/login`
- `_auth/login.tsx` resolves to `/login` unless a deeper non-underscore path segment contributes to the URL

This gives VorzelaJs underscore-only layout/group semantics.

## Route Groups Research Result

Route groups are implemented in a limited underscore-only form.

Why:

- underscore-prefixed files can become pathless parent routes
- underscore-prefixed directories can group child routes without contributing to the URL
- the generator preserves parent chains for underscore pathless ancestors

Consequence:

- underscore-only pathless layout/group routes work
- parentheses groups still do not work
- general nested layout semantics outside underscore pathless routes are still limited

## Partial Hydration Research Result

Partial hydration is implemented at route-branch granularity.

Code-based reasons:

- route generation emits `src/routeHydration.gen.ts`
- SSR wraps matched client branches in `data-vrz-island-root` markers
- the client router swaps server-rendered HTML and hydrates only the matched client branches
- automatic detection follows each route module and its local imports

What VorzelaJs currently has instead:

- streamed SSR for the initial response
- payload-driven HTML navigation for same-origin routes
- route-branch island hydration

Current limitations:

- island granularity is the matched route branch, not arbitrary nested child components
- automatic analysis follows local imports; non-local shared code may still need `hydration: 'client'`
- there is no resumability layer

## `.server` Helper Result

VorzelaJs supports colocated `.server` helpers for server-only route logic.

Current behavior:

- `*.server.ts` and `*.server.tsx` under `src/routes` are ignored by route generation
- `.server` imports are allowed when they are only used by `loader`, `beforeLoad`, or `validateSearch`
- those server-only route hooks are stripped from the client build, along with matching `.server` imports
- `.server` imports used from route components or other client-visible modules fail the client build

Practical meaning:

- database clients, `node:fs`, `node:crypto`, and other Node-only packages can live in route-local `.server` helpers
- the safe pattern is to fetch or compute server-only data in `loader()` and pass the result into `head()` or the route component as loader data

## SEO and Crawlability Result

VorzelaJs now supports basic SEO and crawler-control primitives.

Current behavior:

- `head()` supports `canonical` and `jsonLd` in addition to `title`, `meta`, and `links`
- the document renderer emits canonical links and JSON-LD scripts during SSR and keeps them in sync on client navigation
- the server runtime serves `/robots.txt` from `robotsConfig` or `defaultRobotsConfig()`
- the server runtime serves `/sitemap.xml` from `getSitemapEntries()`

Current limitations:

- the default sitemap generation skips dynamic `$` routes unless the app exports them explicitly
- there is no higher-level metadata DSL beyond raw `head()` objects

## Error Handling Research Result

### Implemented Today

- redirects via `redirect()`
- safe intended-redirect helpers via `withRedirectParam()` and `resolveRedirectTarget()`
- not-found handling via `notFound()` and `notFoundComponent`
- route-scoped `errorComponent` rendering
- automatic route render containment through Solid `ErrorBoundary`
- `404` SSR/payload status propagation
- route-scoped validateSearch, loader, and beforeLoad `500` responses
- generic server `500` fallback responses

### Not Implemented Today

- typed status error helpers such as `badRequest()`, `unauthorized()`, `forbidden()`, `internalServerError()`
- nested error boundary bubbling
- custom `500` page rendering in the router
- first-class status-family UI APIs for 400/500 families beyond the current route-scoped fallback model

### Practical Meaning

Current status handling is:

- `404`: supported
- redirects: supported
- route-scoped `500`: supported for loader and beforeLoad failures
- route-scoped render fallback: supported
- structured `400` / `500` route UI: not supported

## Recommendation

If the next goal is framework parity with router-framework mode systems, the most important missing features are:

1. parentheses-style groups and richer nested layout semantics
2. structured status-aware error helper APIs
3. stronger nested route tree modeling beyond underscore pathless parents
4. finer-grained nested component islands beyond route-branch boundaries