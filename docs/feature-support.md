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
| `head` | Yes | Implemented |
| `notFound()` / `notFoundComponent` | Yes | Implemented with 404 status |
| `redirect()` | Yes | Implemented on server and client |
| `errorComponent` | Yes | Implemented for route-scoped loader and render failures |
| Streamed SSR | Yes | Implemented in `src/entry-server.tsx` |
| Full-app hydration | Yes | Implemented in `src/entry-client.tsx` |
| Hybrid server payload route mode | Yes | Implemented through `/__vorzela/payload` |
| `_guest` or `_protected` ignored from URL | Yes | Underscore-prefixed files and folders are pathless |
| Route groups | Yes, limited | Supported for underscore-only pathless files and folders |
| Partial hydration / islands | No | Single root `hydrate()` call; no island system |
| Route-level error boundaries | Yes, limited | Automatic route-scoped fallbacks exist; typed status helpers do not |
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

Partial hydration is not implemented.

Code-based reasons:

- the client entry performs one `hydrate()` call for the entire app root
- the document ships a single app bootstrap path
- there is no island registration layer
- there is no lazy per-island activation system

What VorzelaJs currently has instead:

- streamed SSR for the initial response
- a full client hydration pass
- a server-payload route mode for selected transitions

That is useful, but it is not the same as partial hydration.

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
4. an islands or partial-hydration architecture if partial hydration is a real product goal