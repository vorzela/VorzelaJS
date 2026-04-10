# PWA Support

This guide documents the current VorzelaJs Progressive Web App support.

## Overview

VorzelaJs provides opt-in PWA support with zero external dependencies. When enabled, the framework generates a web app manifest, a preconfigured service worker, and an offline fallback page. The service worker uses cache-first for hashed assets and network-first for navigation requests.

## Enabling PWA

Create or update `vite.config.ts` at the project root:

```ts
import { resolveVorzelaConfig } from 'vorzelajs/vite'

export default resolveVorzelaConfig(import.meta.dirname, { pwa: true })
```

Or pass an options object for customization:

```ts
import { resolveVorzelaConfig } from 'vorzelajs/vite'

export default resolveVorzelaConfig(import.meta.dirname, {
  pwa: {
    name: 'My App',
    shortName: 'MyApp',
    themeColor: '#1e293b',
    backgroundColor: '#0f172a',
    display: 'standalone',
  },
})
```

When using `vorzelaPlugin()` directly:

```ts
import { vorzelaPlugin } from 'vorzelajs/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vorzelaPlugin({ pwa: true })],
})
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `name` | `string` | `'VorzelaJs App'` | Full app name shown in install prompts |
| `shortName` | `string` | `'VorzelaJs'` | Short name for home screen |
| `themeColor` | `string` | `'#09111f'` | Browser chrome color and `<meta name="theme-color">` |
| `backgroundColor` | `string` | `'#09111f'` | Splash screen background |
| `display` | `string` | `'standalone'` | Display mode: `standalone`, `fullscreen`, `minimal-ui`, `browser` |
| `icons` | `PwaIconDescriptor[]` | 192px + 512px defaults | App icons for manifest |

## What Gets Generated

When PWA is enabled and you run `vorzelajs build`, three files are emitted to `dist/client/`:

- **`sw.js`** — Service worker with precache list derived from the Vite build manifest
- **`manifest.webmanifest`** — Web app manifest JSON
- **`offline.html`** — Styled offline fallback page with retry button

## Service Worker Behavior

The generated service worker uses these caching strategies:

- **`/assets/*`** — Cache-first. Hashed assets are immutable and served from cache when available.
- **Navigation requests** — Network-first. Falls back to cached version, then to `/offline.html` when offline.
- **Other requests** — Network-first with cache fallback.

On install, the service worker precaches all hashed assets from the build plus `/offline.html`. On activate, it cleans up old caches from previous builds.

Current behavior:

- Cache names are versioned with a hash of the precache URL list
- `skipWaiting()` and `clients.claim()` are called automatically
- The service worker is not registered in development mode to avoid breaking HMR

## Document Injection

When PWA is enabled, the document shell automatically includes:

```html
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#09111f">
```

These are injected in both development and production.

## Client Registration

In production, the service worker is registered after the router initializes:

```js
navigator.serviceWorker.register('/sw.js')
```

Registration is silently skipped when:

- The browser does not support service workers
- The app is running in development mode (`import.meta.env.DEV`)
- No `sw.js` file exists (PWA not enabled in the build)

## Development Mode

During `npm run dev`:

- The web app manifest is served at `/manifest.webmanifest` by the Vite dev server
- `<link rel="manifest">` and `<meta name="theme-color">` are present in the document
- The service worker is **not** registered (would break HMR)
- Chrome DevTools → Application tab will show the manifest for inspection

## PWA Icons

Place `icon-192.png` (192×192) and `icon-512.png` (512×512) in your `public/` directory. The default configuration references these paths.

Projects scaffolded with `create-vorzelajs` include placeholder icons automatically.

To use custom icons, pass the `icons` option:

```ts
export default resolveVorzelaConfig(import.meta.dirname, {
  pwa: {
    icons: [
      { src: '/my-icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/my-icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/my-icon-maskable.png', sizes: '512x512', type: 'image/png' },
    ],
  },
})
```

## Cache Helpers

Import client-side cache utilities from `vorzelajs/pwa`:

```ts
import { clearCache, isOffline, onOffline, onOnline } from 'vorzelajs/pwa'
```

### `clearCache()`

Deletes all VorzelaJs service worker caches. Returns a promise.

```ts
await clearCache()
```

### `isOffline()`

Returns `true` when the browser reports no network connection.

```ts
if (isOffline()) {
  showOfflineBanner()
}
```

### `onOffline(callback)` / `onOnline(callback)`

Subscribe to connectivity changes. Returns an unsubscribe function.

```ts
const unsubscribe = onOffline(() => {
  console.log('Went offline')
})

// Later
unsubscribe()
```

## Server Behavior

In production, the server serves PWA files with appropriate headers:

| Path | Content-Type | Cache | Notes |
|------|-------------|-------|-------|
| `/sw.js` | `application/javascript` | `no-cache` | `Service-Worker-Allowed: /` header set |
| `/manifest.webmanifest` | `application/manifest+json` | `public, max-age=3600` | |
| `/offline.html` | `text/html` | `public, max-age=3600` | |

These routes return 404 if the files were not generated (PWA not enabled during build).

## Scaffolding

When creating a new project with `create-vorzelajs`, you are prompted:

```
Enable PWA? (y/N)
```

Choosing yes generates a `vite.config.ts` with `pwa: true` and includes the default PWA icons.

All scaffolded projects now generate a `vite.config.ts` that uses `resolveVorzelaConfig()`, regardless of PWA choice.

## Current Limitations

- The service worker template is not customizable beyond the config options
- No workbox integration; the service worker is self-contained plain JS
- No background sync or push notification support
- Offline fallback is a generic page; per-route offline content is not supported
- No `beforeinstallprompt` helper for custom install UI
- Cache strategy is fixed (cache-first assets, network-first pages)
