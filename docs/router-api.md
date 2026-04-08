# Router API Reference

This guide covers every helper currently exported from `~/router`.

Regular application code will mainly use:

- `createRootRoute`
- `createFileRoute`
- `createRouter`
- `Link`
- `Outlet`
- `RouterProvider`
- `redirect`
- `resolveRedirectTarget`
- `withRedirectParam`
- `filterSearch`
- `isRedirect`
- `notFound`
- `isNotFound`
- `errorComponent`
- `useNavigate`
- `useParams`
- `useSearch`
- `useSetSearch`
- `useLoaderData`
- `useRouter`

Advanced/internal runtime helpers also exported today:

- `readBootstrapPayload`
- `renderResolvedMatches`

## `createRootRoute`

Creates the root route definition.

```tsx
import { Outlet, createRootRoute } from '~/router'

export const Route = createRootRoute()({
  head: () => ({
    title: 'App',
  }),
  component: RootComponent,
  errorComponent: RootError,
  notFoundComponent: RootNotFound,
})

function RootComponent() {
  return <Outlet />
}

function RootError() {
  return <div>Root route error</div>
}
```

## `createFileRoute`

Creates a file route definition tied to a path string.

```tsx
import { createFileRoute } from '~/router'

export const Route = createFileRoute('/about')({
  component: AboutPage,
})
```

With loader data typing:

```tsx
import { createFileRoute } from '~/router'
import type { RouteComponentProps } from '~/router'

type LoaderData = { title: string }

export const Route = createFileRoute('/posts/$postId')<LoaderData>({
  loader: async ({ params }) => ({ title: params.postId }),
  component: PostPage,
})

function PostPage(props: RouteComponentProps<'/posts/$postId', LoaderData>) {
  return <h1>{props.loaderData.title}</h1>
}
```

With route-scoped error rendering:

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

With validated search and route-bound search access:

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

  return <div>{resolveRedirectTarget(search().redirect, { defaultTo: '/dashboard' })}</div>
}
```

## `createRouter`

Creates the client router instance from the SSR bootstrap payload.

```tsx
import { RouterProvider, createRouter, readBootstrapPayload } from '~/router'

const router = createRouter(readBootstrapPayload(), {
  context: {
    session: null,
  },
})

await router.init()
```

Current router instance fields:

- `context`
- `init()`
- `navigate()`
- `setSearch()`
- `state()`

`state()` can now contain:

- `notFound`
- `routeError`
- `search`

## `RouterProvider`

Provides the router to the application.

```tsx
import { RouterProvider } from '~/router'

<RouterProvider router={router} />
```

## `Link`

Internal navigation component.

```tsx
import { Link } from '~/router'

<Link to="/about">About</Link>
<Link to="/dashboard" replace>Replace history entry</Link>
```

Current behavior:

- intercepts same-origin left clicks
- respects modifier keys and `_blank`
- falls through for external URLs

## `filterSearch`

Small helper collection for common query-param filter patterns.

Parsing validated route search:

```tsx
import { filterSearch } from '~/router'

const SORT_OPTIONS = ['relevance', 'newest', 'name'] as const

const filters = {
  featured: filterSearch.readBoolean(search, 'featured'),
  page: filterSearch.readPage(search, 'page'),
  q: filterSearch.readText(search, 'q'),
  sort: filterSearch.readSort(search, 'sort', SORT_OPTIONS, 'relevance'),
  tag: filterSearch.readArray(search, 'tag'),
}
```

Building query params for write APIs:

```tsx
import { filterSearch } from '~/router'

const nextSearch = {
  featured: filterSearch.boolean(true),
  page: filterSearch.page(2),
  q: filterSearch.text('solid'),
  sort: filterSearch.sort('newest', 'relevance'),
  tag: filterSearch.array(['alpha', 'beta']),
}
```

## `Outlet`

Renders child route content inside a layout-style route.

```tsx
import { Outlet, createRootRoute } from '~/router'

export const Route = createRootRoute()({
  component: () => <Outlet />,
})
```

## `redirect`

Creates a redirect signal.

```tsx
import { redirect } from '~/router'

throw redirect({ to: '/login' })
throw redirect({ to: '/dashboard', replace: true, status: 307 })
```

## `withRedirectParam`

Builds a route path that includes a safe `redirect` query parameter.

```tsx
import { withRedirectParam } from '~/router'

const loginHref = withRedirectParam('/login', '/reports')
```

Use it when protected routes need to preserve the user's intended destination.

## `resolveRedirectTarget`

Resolves a validated internal redirect target with a safe fallback.

```tsx
import { resolveRedirectTarget } from '~/router'

const target = resolveRedirectTarget(search().redirect, {
  defaultTo: '/dashboard',
  disallowedPrefixes: ['/login'],
})
```

It rejects empty, external, protocol-relative, and explicitly blocked targets.

## `isRedirect`

Type guard for redirect signals.

```tsx
import { isRedirect } from '~/router'

try {
  await maybeNavigate()
} catch (error) {
  if (isRedirect(error)) {
    console.log(error.to)
  }
}
```

## `notFound`

Creates a not-found signal.

```tsx
import { notFound } from '~/router'

throw notFound()
throw notFound({ message: 'Post not found' })
```

## `errorComponent`

`errorComponent` is a route option, not a standalone function export.

It renders automatically when a route's `validateSearch`, `beforeLoad`, `loader`, or component render fails.

Props passed to `errorComponent`:

- `error`
- `reset`

```tsx
import type { RouteErrorContext } from '~/router'

function ReportsError(props: RouteErrorContext) {
  return (
    <button type="button" onClick={props.reset}>
      Retry: {props.error.message}
    </button>
  )
}
```

## `isNotFound`

Type guard for not-found signals.

```tsx
import { isNotFound } from '~/router'

try {
  await loadThing()
} catch (error) {
  if (isNotFound(error)) {
    console.log('Not found')
  }
}
```

## `useNavigate`

Returns the router navigation function.

```tsx
import { useNavigate } from '~/router'

function SaveButton() {
  const navigate = useNavigate()

  return <button onClick={() => void navigate('/dashboard')}>Go</button>
}
```

It also supports object-based navigation with a `to` path plus a full `search` object.

```tsx
void navigate({
  to: '/filters',
  search: {
    page: filterSearch.page(3),
    q: filterSearch.text('solid'),
  },
})
```

## `useParams`

Returns the current route params.

```tsx
import { useParams } from '~/router'

function PostPage() {
  const params = useParams<{ postId: string }>()
  return <div>{params.postId}</div>
}
```

## `useSearch`

Returns an accessor for the current route's validated search object.

```tsx
import { useSearch } from '~/router'

function LoginPage() {
  const search = useSearch<{ redirect?: string }>()
  return <div>{search().redirect}</div>
}
```

If you want route-specific typing without supplying a generic manually, use `Route.useSearch()` on the route definition returned by `createFileRoute()`.

## `useSetSearch`

Returns a helper that merges new query params into the current URL.

```tsx
import { filterSearch, useSetSearch } from '~/router'

function FiltersPage() {
  const setSearch = useSetSearch<{ page: number; q: string }>()

  return (
    <button
      type="button"
      onClick={() => {
        void setSearch({
          page: filterSearch.page(2),
          q: filterSearch.text('solid'),
        }, { replace: true })
      }}
    >
      Update filters
    </button>
  )
}
```

If you want route-specific typing without supplying a generic manually, use `Route.useSetSearch()` on the route definition returned by `createFileRoute()`.

## `useLoaderData`

Returns the current route loader data.

```tsx
import { useLoaderData } from '~/router'

function PostPage() {
  const post = useLoaderData<{ title: string }>()
  return <h1>{post.title}</h1>
}
```

## `useRouter`

Returns the live router instance.

```tsx
import { useRouter } from '~/router'

function DebugRouter() {
  const router = useRouter()
  return <pre>{JSON.stringify(router.state(), null, 2)}</pre>
}
```

## `readBootstrapPayload`

Advanced helper used by the client entry to read the server-injected route state.

```tsx
import { createRouter, readBootstrapPayload } from '~/router'

const router = createRouter(readBootstrapPayload())
```

Typical application routes do not need to call this directly.

## `afterLoad`

`afterLoad` is a route option, not a standalone helper export.

It runs on the client after a successful route commit has rendered and the application has hydrated.

Typical uses:

- analytics page views
- DOM integrations
- focus or scroll corrections that need real elements in place

Current behavior:

- runs on the initial hydrated route
- runs again after successful client navigations
- runs for each matched route that defines it
- does not run during SSR
- is skipped for not-found and route-error commits

```tsx
import { createFileRoute } from '~/router'
import type { RouteAfterLoadContext } from '~/router'

type LoaderData = { title: string }

export const Route = createFileRoute('/reports')<LoaderData>({
  loader: async () => ({ title: 'Reports' }),
  afterLoad: (context: RouteAfterLoadContext<'/reports', LoaderData>) => {
    console.log('Route is ready', context.pathname, context.loaderData.title)
  },
  component: ReportsPage,
})

function ReportsPage() {
  return <h1>Reports</h1>
}
```

## `renderResolvedMatches`

Advanced helper used by the SSR runtime to render the resolved route branch.

```tsx
import { renderResolvedMatches } from '~/router'

const view = renderResolvedMatches(state)
```

Typical application routes do not need to call this directly.

## Exported Types

The router also exports these types:

- `BootstrapPayload`
- `HeadObject`
- `NavigateToOptions`
- `NotFoundState`
- `RenderAssets`
- `RouteAfterLoadContext`
- `RouteBeforeLoadContext`
- `RouteComponentProps`
- `RouteErrorContext`
- `RouteErrorData`
- `RouteErrorState`
- `RouteLocation`
- `RouteMode`
- `RouteParams`
- `RoutePayloadEnvelope`
- `RouteSearch`
- `RouteSearchInput`
- `RouteSearchUpdater`
- `RouterCreateOptions`
- `SetSearchFunction`
- `SetSearchOptions`

## Notes on Missing APIs

The current router does not export:

- action helpers
- preload helpers
- parentheses-group helpers
- typed status helper constructors for structured 400/500 families