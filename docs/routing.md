# Routing Guide

This guide documents the current VorzelaJs router behavior as implemented today.

## Routing Model

VorzelaJs uses a generated route manifest built from files under `src/routes`.

Generation happens in `scripts/generate-routes.ts` and writes `src/routeTree.gen.ts`.

The runtime then resolves routes from that generated manifest in `src/router/resolve.ts`.

## Route File Conventions

Supported conventions today:

- `__root.tsx` becomes the root route with id `__root__`
- `index.tsx` becomes `/`
- `_guest.tsx` becomes a pathless route with internal id `/_guest`
- `_guest/login.tsx` becomes `/login` with parent `/_guest`
- `about.tsx` becomes `/about`
- `posts/index.tsx` becomes `/posts`
- `posts/$postId.tsx` becomes `/posts/$postId`
- `$.tsx` becomes the catch-all route `/$`
- `.server.ts` and `.server.tsx` files are ignored as routes and can be used for colocated server-only helpers

### `.server` Helpers

Use `.server.ts` and `.server.tsx` files for code that should never ship to the browser.

Recommended pattern:

```tsx
import { createFileRoute } from '~/router'

import { getPosts } from './posts.server'

export const Route = createFileRoute('/posts')({
  loader: () => getPosts(),
  component: PostsPage,
})
```

Rules:

- `.server` files under `src/routes` do not become routes
- `.server` imports are allowed in `loader`, `beforeLoad`, and `validateSearch`
- `.server` imports must not be used by route components, shared client modules, or other browser-visible code
- if `head()` needs server-only data, compute it in `loader()` and read it from `loaderData`

### Dynamic Segments

Any file segment beginning with `$` becomes a dynamic param.

Example:

```tsx
src/routes/posts/$postId.tsx
```

becomes:

```tsx
/posts/$postId
```

and the route receives:

```tsx
params.postId
```

## Underscore Pathless Semantics

Underscore-prefixed files and directories are treated as pathless.

That means:

- `_guest.tsx` is ignored in the URL path and acts as a pathless layout/group route
- `_guest/login.tsx` resolves to `/login`
- `_protected/account.tsx` resolves to `/account`

Internal route ids still preserve the underscore path so the manifest can distinguish pathless routes from normal routes.

## Route Groups

Route groups are supported only through underscore-prefixed files and folders.

Supported now:

- underscore pathless route files such as `_guest.tsx`
- underscore grouping folders such as `_guest/login.tsx`

Not supported yet:

- parentheses groups such as `(auth)`
- general non-underscore nested layout semantics by default file tree structure alone

## Route Definitions

Import route builders from `~/router`.

Import cookies, sessions, analytics, and robots helpers from `~/router/server`.

### Root Route Example

```tsx
import { Outlet, createRootRoute } from '~/router'

export const Route = createRootRoute()({
  head: () => ({
    title: 'My App',
  }),
  component: RootComponent,
  notFoundComponent: RootNotFound,
})

function RootComponent() {
  return <Outlet />
}

function RootNotFound() {
  return <div>Not found</div>
}
```

### File Route Example

```tsx
import { createFileRoute } from '~/router'

export const Route = createFileRoute('/about')({
  head: () => ({
    title: 'About',
  }),
  component: AboutPage,
})
```

## Route Options

Current supported route options:

- `component`
- `errorComponent`
- `head`
- `hydration`
- `loader`
- `validateSearch`
- `beforeLoad`
- `afterLoad`
- `notFoundComponent`

## `errorComponent`

Routes can provide an `errorComponent` for automatic route-scoped error rendering.

If `validateSearch`, `beforeLoad`, `loader`, or the route component throws, VorzelaJs renders the route error fallback inside the failing route slot instead of breaking the whole app shell.

Example:

```tsx
import { createFileRoute } from '~/router'
import type { RouteErrorContext } from '~/router'

export const Route = createFileRoute('/reports')({
  loader: async () => {
    throw new Error('Reports failed to load')
  },
  errorComponent: ReportsError,
  component: ReportsPage,
})

function ReportsPage() {
  return null
}

function ReportsError(props: RouteErrorContext) {
  return <button onClick={props.reset}>{props.error.message}</button>
}
```

## `validateSearch`

`validateSearch` turns raw query-string input into route-specific search state.

The return value is serialized into the resolved route state and becomes available in:

- `beforeLoad`
- `loader`
- `head`
- `afterLoad`
- route component props
- `Route.useSearch()`
- `Route.useSetSearch()`

Keep the returned value JSON-serializable, because it is included in the SSR bootstrap payload.

Example:

```tsx
import { createFileRoute, resolveRedirectTarget } from '~/router'

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  component: LoginPage,
})

function LoginPage() {
  const search = Route.useSearch()
  const redirectTarget = () => resolveRedirectTarget(search().redirect, {
    defaultTo: '/dashboard',
    disallowedPrefixes: ['/login'],
  })

  return <div>{redirectTarget()}</div>
}
```

For filter-style routes, combine `validateSearch` with `filterSearch`:

```tsx
import { createFileRoute, filterSearch } from '~/router'

const SORT_OPTIONS = ['relevance', 'newest', 'name'] as const

export const Route = createFileRoute('/filters')({
  validateSearch: (search) => ({
    featured: filterSearch.readBoolean(search, 'featured'),
    page: filterSearch.readPage(search, 'page'),
    q: filterSearch.readText(search, 'q'),
    sort: filterSearch.readSort(search, 'sort', SORT_OPTIONS, 'relevance'),
    tag: filterSearch.readArray(search, 'tag'),
  }),
  component: FiltersPage,
})
```

## `beforeLoad`

`beforeLoad` runs before the route loader and component render.

Context passed to `beforeLoad`:

- `context`
- `location`
- `params`
- `pathname`
- `request`
- `response`
- `search`

Example:

```tsx
import { createFileRoute, redirect, withRedirectParam } from '~/router'

export const Route = createFileRoute('/dashboard')({
  beforeLoad: async ({ context, location }) => {
    if (!context.session) {
      throw redirect({
        to: withRedirectParam('/login', location.pathname),
      })
    }
  },
  component: DashboardPage,
})
```

## `loader`

`loader` runs after `beforeLoad` and before the route component receives its props.

Context passed to `loader`:

- `context`
- `location`
- `params`
- `pathname`
- `request`
- `response`
- `search`

Today the practical `response` surface is `response.headers`. Those headers are forwarded through both streamed document responses and payload responses.

Example:

```tsx
import { createFileRoute } from '~/router'
import type { RouteComponentProps } from '~/router'

type PostLoaderData = {
  title: string
}

export const Route = createFileRoute('/posts/$postId')<PostLoaderData>({
  loader: async ({ params }) => {
    return { title: params.postId }
  },
  component: PostPage,
})

function PostPage(props: RouteComponentProps<'/posts/$postId', PostLoaderData>) {
  return <h1>{props.loaderData.title}</h1>
}
```

For Node-only dependencies, import a colocated `.server` helper and call it from `loader()`:

```tsx
import { createFileRoute } from '~/router'

import { getPostById } from './post.server'

export const Route = createFileRoute('/posts/$postId')({
  loader: ({ params }) => getPostById(params.postId),
  component: PostPage,
})
```

For cookies or other route-level headers, write to `response.headers` and let the runtime forward them:

```tsx
import { createFileRoute } from '~/router'
import { createCookie, setCookie } from '~/router/server'

const sessionCookie = createCookie('__Host-session', {
  secrets: ['replace-me'],
})

export const Route = createFileRoute('/login')({
  loader: async ({ response }) => {
    await setCookie(response, sessionCookie, 'signed-session-value')
    return null
  },
  component: LoginPage,
})
```

## `afterLoad`

`afterLoad` runs on the client after a successful route commit is visible and any matched route islands have hydrated.

Use it for post-render side effects such as analytics, DOM integration, or focus management that should happen after the route is visible.

Context passed to `afterLoad`:

- `context`
- `loaderData`
- `location`
- `params`
- `pathname`
- `search`

Current behavior:

- runs on the initial hydrated route
- runs again after successful client navigations
- runs for each matched route in the resolved branch that defines it
- does not run during SSR
- is skipped for route-error and not-found commits

Example:

```tsx
import { createFileRoute } from '~/router'

export const Route = createFileRoute('/reports')({
  loader: async () => ({ title: 'Reports' }),
  afterLoad: ({ loaderData, pathname }) => {
    document.title = `${loaderData.title} | ${pathname}`
  },
  component: ReportsPage,
})

function ReportsPage() {
  return <h1>Reports</h1>
}
```

## `hydration`

Routes can override automatic route-branch island detection.

Supported values:

- `auto` - default; use generated analysis from the route module and its local imports
- `client` - force the matched route branch to hydrate on the client
- `static` - force the matched route branch to remain static HTML

Current granularity is route-branch level. If a match is marked `client`, VorzelaJs hydrates from that matched route downward until the branch ends or another boundary starts.

Example:

```tsx
export const Route = createFileRoute('/marketing')({
  hydration: 'static',
  component: MarketingPage,
})
```

## `head`

Routes can return document head metadata.

Supported head fields:

- `title`
- `meta`
- `links`
- `canonical`
- `jsonLd`

Example:

```tsx
head: ({ loaderData, pathname }) => ({
  title: loaderData.title,
  canonical: `https://example.com${pathname}`,
  meta: [
    { name: 'description', content: 'Route description' },
  ],
  jsonLd: {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: loaderData.title,
  },
})
```

Canonical links and JSON-LD are rendered during SSR and kept in sync during client navigation.

## `notFoundComponent`

Routes can provide a custom not-found renderer.

If a route throws `notFound()`, VorzelaJs walks backward through the loaded branch and renders the nearest route that defines `notFoundComponent`.

If none exists, the runtime uses its internal default 404 component.

## Redirects

Use `redirect()` to interrupt route resolution.

```tsx
throw redirect({ to: '/login' })
```

Server-side redirects become HTTP redirects.
Client-side redirects recurse through the router and navigate to the redirected location.

## Not Found Handling

Use `notFound()` to mark a route as unresolved.

```tsx
import { createFileRoute, notFound } from '~/router'

export const Route = createFileRoute('/posts/$postId')({
  beforeLoad: ({ params }) => {
    if (!hasPost(params.postId)) {
      throw notFound()
    }
  },
  component: PostPage,
})
```

The current implementation converts that into:

- a rendered not-found component
- a `404` response status during SSR and payload responses

## Navigation APIs

Use these in route components:

- `Link`
- `Outlet`
- `useNavigate()`
- `useParams()`
- `useLoaderData()`
- `Route.useSearch()` or `useSearch()`
- `Route.useSetSearch()` or `useSetSearch()`
- `useRouter()`

## Search Updates

Use `useSetSearch()` when you want to merge new query params into the current URL.

This is the easiest way to keep filters shareable without rebuilding the full query string manually.

```tsx
import { createFileRoute, filterSearch } from '~/router'

export const Route = createFileRoute('/filters')({
  validateSearch: (search) => ({
    page: filterSearch.readPage(search, 'page'),
    q: filterSearch.readText(search, 'q'),
  }),
  component: FiltersPage,
})

function FiltersPage() {
  const setSearch = Route.useSetSearch()

  return (
    <input
      type="search"
      onInput={(event) => {
        void setSearch({
          page: filterSearch.page(1),
          q: filterSearch.text(event.currentTarget.value),
        }, { replace: true })
      }}
    />
  )
}
```

Use `navigate({ to, search })` when you want to navigate with an explicit search object.

Unlike `setSearch`, this treats `search` as the next full search object for that target.

```tsx
const navigate = useNavigate()

void navigate({
  to: '/filters',
  search: {
    page: filterSearch.page(3),
    q: filterSearch.text('solid'),
    sort: filterSearch.sort('newest', 'relevance'),
  },
})
```

## Filter Helpers

`filterSearch` is a small helper for common deeplinked filter patterns.

Read helpers:

- `filterSearch.readArray(search, key)`
- `filterSearch.readBoolean(search, key)`
- `filterSearch.readPage(search, key?)`
- `filterSearch.readSort(search, key, allowed, fallback)`
- `filterSearch.readText(search, key)`

Write helpers:

- `filterSearch.array(values)`
- `filterSearch.boolean(value)`
- `filterSearch.page(value, defaultPage?)`
- `filterSearch.sort(value, defaultValue?)`
- `filterSearch.text(value)`

See `docs/router-api.md` for detailed examples.

## Dev-Time Route Regeneration

While `npm run dev` is running, VorzelaJs watches route files and other `src/**/*.ts[x]` files that can affect hydration analysis, regenerating both `src/routeTree.gen.ts` and `src/routeHydration.gen.ts` on add, change, and unlink events.

That means new route files and changed client or static hydration detection are picked up without restarting the dev server.

## What Is Missing

The router still lacks:

- parentheses-style route groups
- broad nested layout semantics outside underscore pathless routes
- typed status helper APIs for structured 400/500 families