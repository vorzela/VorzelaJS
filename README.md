# VorzelaJs

Batteries-included SolidJS framework with file-based routing, streamed SSR, server-only boundaries, and zero config.

## Create a New App

```bash
npm create vorzelajs@latest my-app
cd my-app
npm install
npm run dev
```

You'll be prompted for:

- **Template** — `modern` (multi-page with nav) or `bare` (single landing page)
- **Styling** — `tailwindcss`, `css-modules`, or `css`
- **PWA** — Enable progressive web app support

## Manual Setup

```bash
mkdir my-app && cd my-app
npm init -y
npm install vorzelajs solid-js
```

Add scripts to `package.json`:

```json
{
  "scripts": {
    "dev": "vorzelajs dev",
    "build": "vorzelajs build",
    "serve": "NODE_ENV=production vorzelajs serve"
  }
}
```

Create your first route:

```tsx
// src/routes/__root.tsx
import { createRootRoute, Outlet } from 'vorzelajs'

export const Route = createRootRoute({
  component: () => <Outlet />,
})
```

```tsx
// src/routes/index.tsx
import { createFileRoute } from 'vorzelajs'

export const Route = createFileRoute('/')({
  component: () => <h1>Hello VorzelaJs</h1>,
  head: () => ({ title: 'Home' }),
})
```

Add a stylesheet at `src/styles.css` and run `npm run dev`.

## Project Structure

```
src/
├── routes/         # File-based routes (pages and layouts)
├── components/     # Reusable UI components
├── lib/            # Helpers, API clients, utilities
├── styles.css      # Global styles
```

You own `src/`. The framework handles Vite config, server, SSR entry, and document shell.

## Features

- **File-based routing** — Drop a file in `src/routes/` and it becomes a route with automatic code splitting
- **Streamed SSR** — Server-rendered HTML streams to the browser with selective hydration per route branch
- **Server-only boundaries** — `.server.ts` files and route `loader`/`beforeLoad` are stripped from the client bundle
- **Payload navigation** — Client navigations fetch JSON payloads instead of full page reloads
- **Head management** — Per-route `<title>`, `<meta>`, `<link>`, canonical URLs, and JSON-LD
- **Cookie & session helpers** — `createCookie()`, `createCookieSessionStorage()` via `vorzelajs/server`
- **Analytics** — First-party analytics with `defineAnalytics()` and `createAnalyticsClient()`
- **SEO** — Robots.txt, sitemap.xml, and structured data built in
- **PWA** — Opt-in service worker, web app manifest, and offline fallback with `pwa: true`
- **Security headers** — CSP with nonces, HSTS, X-Frame-Options, and more out of the box
- **Zero config** — No `vite.config.ts` or `server.ts` required

## Routes

### Basic Route

```tsx
import { createFileRoute } from 'vorzelajs'

export const Route = createFileRoute('/about')({
  component: AboutPage,
  head: () => ({
    title: 'About',
    meta: [{ name: 'description', content: 'About us' }],
  }),
})

function AboutPage() {
  return <h1>About</h1>
}
```

### Route with Server Loader

```tsx
import { createFileRoute } from 'vorzelajs'
import { db } from '~/lib/db.server'

export const Route = createFileRoute('/posts')({
  loader: async () => {
    const posts = await db.posts.findMany()
    return { posts }
  },
  component: PostsPage,
})

function PostsPage() {
  const { posts } = Route.useLoaderData()
  return <ul>{posts.map((p) => <li>{p.title}</li>)}</ul>
}
```

### Dynamic Routes

```
src/routes/posts/$postId.tsx  → /posts/:postId
src/routes/users/$userId.tsx  → /users/:userId
```

Access params with `Route.useParams()`.

### Pathless Layouts

Prefix with `_` to create layout wrappers without adding a URL segment:

```
src/routes/_auth.tsx          → layout (no URL segment)
src/routes/_auth/login.tsx    → /login
src/routes/_auth/register.tsx → /register
```

## Server Exports

Import server helpers from `vorzelajs/server`:

```tsx
import { createCookie, defineAnalytics, defineRobotsConfig } from 'vorzelajs/server'
```

## Styling

The framework detects your styling choice automatically:

- **Tailwind CSS** — Install `tailwindcss` + `@tailwindcss/vite` and add `@import "tailwindcss"` to `styles.css`
- **CSS Modules** — Create `*.module.css` files (Vite handles them natively)
- **Plain CSS** — Write global CSS in `styles.css`

Bring your own fonts. The default font stack is system fonts.

## Commands

| Command | Description |
|---------|-------------|
| `vorzelajs dev` | Start dev server with HMR |
| `vorzelajs build` | Build client and server for production |
| `vorzelajs serve` | Serve the production build |

## PWA

Enable PWA by adding a `vite.config.ts`:

```ts
import { resolveVorzelaConfig } from 'vorzelajs/vite'

export default resolveVorzelaConfig(import.meta.dirname, { pwa: true })
```

This generates a service worker (cache-first assets, network-first pages), web app manifest, and offline fallback page at build time. See [docs/pwa.md](docs/pwa.md) for full configuration options and cache helpers.

## Vite Escape Hatch

For advanced use cases, import the plugin directly:

```ts
// vite.config.ts
import { vorzelaPlugin } from 'vorzelajs/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vorzelaPlugin()],
})
```

## License

MIT