# Build Pipeline Guide

This guide documents the current VorzelaJs route generation, hydration analysis, and client-build stripping pipeline.

## Overview

The framework currently has three related build-time systems:

- route generation from `src/routes`
- automatic route hydration analysis
- client-build stripping of server-only route hooks and `.server` imports

The relevant source files are:

- `scripts/generate-routes.ts`
- `vite.config.ts`
- `src/routeTree.gen.ts`
- `src/routeHydration.gen.ts`

## Generated Files

VorzelaJs generates two files:

- `src/routeTree.gen.ts`
- `src/routeHydration.gen.ts`

`src/routeTree.gen.ts` contains the generated route manifest, route ids, and route importers.

`src/routeHydration.gen.ts` contains the detected hydration mode for each generated route id.

Both files are generated artifacts and should not be edited manually.

## Route Generation Rules

Current route generation behavior:

- scans `src/routes`
- ignores `*.d.ts`
- ignores `*.server.ts` and `*.server.tsx`
- ignores files under `.server/` directories
- treats underscore-prefixed files and folders as pathless
- generates distinct internal ids even when the public URL is pathless
- throws on duplicate routable public paths

That means `.server` files can sit next to routes without becoming routes themselves.

## Automatic Hydration Analysis

Hydration analysis decides whether a route branch is detected as `client` or `static`.

Current detection triggers include:

- JSX event handlers such as `onClick=`
- router hooks such as `useNavigate`, `useSetSearch`, and `Route.useSetSearch`
- Solid client hooks such as `createSignal`, `createEffect`, `createRenderEffect`, `createResource`, `onMount`, and `onCleanup`
- browser globals such as `window`, `document`, `navigator`, `localStorage`, and `sessionStorage`
- browser functions such as `requestAnimationFrame()` and `matchMedia()`

The generator also follows local imports recursively through:

- `import ... from './x'`
- side-effect imports like `import './x'`
- dynamic imports like `import('./x')`

Current limitation:

- only local relative imports are followed automatically
- non-local shared code may still require explicit `hydration: 'client'`

## Hydration Overrides

Routes can override the detected mode with:

```tsx
export const Route = createFileRoute('/marketing')({
  hydration: 'static',
  component: MarketingPage,
})
```

Supported values:

- `auto`
- `client`
- `static`

Use `auto` when detection is sufficient, `client` when analysis misses an interactive dependency, and `static` when a route should stay server-rendered only.

## Development Watch Behavior

During `npm run dev`, the route plugin watches not only route files but also other `src/**/*.ts[x]` files that can change hydration analysis.

Current behavior:

- add, change, and unlink events regenerate `src/routeTree.gen.ts`
- add, change, and unlink events regenerate `src/routeHydration.gen.ts`
- generated files themselves are ignored by the watch trigger

That is why hydration classification updates without restarting the dev server.

## `.server` Route Helpers

Use colocated `.server.ts` and `.server.tsx` files for Node-only route logic.

Example:

```tsx
import { createFileRoute } from '~/router'

import { getServerPayloadData } from './server-payload.server'

export const Route = createFileRoute('/server-payload')({
  loader: () => getServerPayloadData(),
  component: ServerPayloadPage,
})
```

This is the right place for code that imports:

- `node:*` modules
- database drivers
- filesystem access
- server-only SDKs

## Client-Build Stripping Rules

During the client build, VorzelaJs applies a Vite transform that protects the browser bundle from server-only route code.

Current behavior:

- strips `loader`, `beforeLoad`, and `validateSearch` from route modules in the client build
- removes matching `.server` imports when they are only referenced by those stripped hooks
- removes top-level helper declarations that only exist to serve those stripped hooks

The client build also throws when `.server` code leaks into browser-visible modules.

Rejected cases include:

- side-effect `.server` imports in client-visible code
- re-exporting a `.server` module from route code
- using a `.server` dynamic import outside `loader`, `beforeLoad`, or `validateSearch`
- importing `.server` modules from normal client modules under `src/`

The safe rule is:

- fetch or compute server-only data in `loader()`, `beforeLoad()`, or `validateSearch()`
- pass the result into `head()` or the route component through validated search or loader data

## CSS and Frontend Build Defaults

The current frontend build also does a few framework-level things worth knowing:

- enables Tailwind through `@tailwindcss/vite`
- uses `cssCodeSplit: false` so client CSS ships as a single bundle
- serves local Inter font files via `@fontsource/inter`
- reads the client manifest in production and collects all built CSS assets into the document

This is why route navigations do not depend on late route-level CSS chunk discovery.

## PWA File Generation

When PWA is enabled via `vorzelaPlugin({ pwa: true })` or `resolveVorzelaConfig(root, { pwa: true })`, the client build also emits:

- `dist/client/sw.js` — Service worker with a precache list of all hashed assets
- `dist/client/manifest.webmanifest` — Web app manifest JSON
- `dist/client/offline.html` — Styled offline fallback page

These files are generated in the Vite `generateBundle` hook from the `vorzelajs-pwa` plugin, using the complete bundle to build the asset precache list.

See [pwa.md](pwa.md) for full configuration and caching strategy details.

## Practical Guidance

If a route unexpectedly stays static:

1. check whether the interactive dependency is only reachable through non-local shared imports
2. set `hydration: 'client'` on that route when needed

If the client build fails with a `.server` import error:

1. move the `.server` import into `loader`, `beforeLoad`, or `validateSearch`
2. stop re-exporting `.server` modules from browser-visible code
3. move Node-only logic behind a route-local `.server` helper and return plain JSON-ready data