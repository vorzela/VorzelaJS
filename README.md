# VorzelaJs

VorzelaJs is a custom SolidJS framework runtime built on top of Hono and Vite.

The current implementation provides:

- streamed SSR for the initial document
- client-side navigation after hydration
- file-based route generation into `src/routeTree.gen.ts`
- underscore-only pathless routes and route groups
- route-level code splitting through Vite dynamic imports
- route helpers such as `validateSearch`, `beforeLoad`, `afterLoad`, `redirect`, `notFound`, `notFoundComponent`, and `errorComponent`
- client-side query-string write helpers for filter-style deeplinks
- automatic route-scoped error rendering that keeps parent layouts mounted
- a hybrid `server-payload` route mode for client transitions that fetch fresh server-rendered HTML
- automatic port fallback when the requested app port is already in use

This repository is still framework-core work, not a finished general-purpose framework release.

## Quick Start

```bash
npm install
npm run dev
```

The app defaults to `3080`, but if that port is already occupied VorzelaJs will automatically try `3081`, `3082`, and so on.

## Commands

```bash
npm run dev
npm run check
npm run build
npm run serve
```

## Documentation

- `docs/routing.md` - file-based routing, route conventions, route lifecycle, route modes
- `docs/ssr.md` - server rendering, streaming, hydration model, payload route behavior
- `docs/server-runtime.md` - Hono/Vite runtime, production asset serving, security headers, port fallback
- `docs/router-api.md` - API reference and examples for every helper exported from `~/router`
- `docs/feature-support.md` - researched support matrix for `_` files, route groups, partial hydration, and error handling

## Current Status

Today VorzelaJs supports:

- root and file routes
- underscore-only pathless route files and grouping folders
- dynamic params such as `$postId`
- catch-all routes through `$.tsx`
- route `head`, `loader`, `validateSearch`, `beforeLoad`, `afterLoad`, `mode`, `notFoundComponent`, and `errorComponent`
- query-string preservation across SSR and client navigation
- merge-aware search updates and object-based search navigation
- redirects and not-found signals
- automatic route-scoped error rendering for loader and component failures
- streamed SSR of the initial document
- full-app hydration on the client

Today VorzelaJs does not support:

- parentheses-style route groups
- partial hydration or islands
- structured status helper APIs for arbitrary `400` / `500` classes

Read `docs/feature-support.md` for the research-backed details.