# Router API Reference

This guide covers the public helper barrels and major route options currently implemented by VorzelaJs.

Use `~/router` for route definitions, navigation, search helpers, rendering, and route lifecycle hooks.

Use `~/router/server` for cookies, sessions, analytics, and robots helpers.

Main imports from `~/router`:

- `createRootRoute`
- `createFileRoute`
- `createRouter`
- `Link`
- `Outlet`
- `redirect`
- `resolveRedirectTarget`
- `withRedirectParam`
- `filterSearch`
- `isRedirect`
- `notFound`
- `isNotFound`
- `useNavigate`
- `useParams`
- `useSearch`
- `useSetSearch`
- `useLoaderData`
- `useRouter`

Main imports from `~/router/server`:

- `DEFAULT_ANALYTICS_ENDPOINT`
- `createCookie`
- `createCookieSessionStorage`
- `cookiePolicies`
- `setCookie`
- `deleteCookie`
- `createAnalyticsClient`
- `defineAnalytics`
- `extractAnalyticsTouchPoint`
- `handleAnalyticsRequest`
- `classifyAnalyticsTraffic`
- `defaultRobotsConfig`
- `defineRobotsConfig`
- `renderRobotsTxt`

Route options documented here:

- `afterLoad`
- `errorComponent`
- `hydration`

Advanced or internal runtime helpers exported from `~/router`:

- `RouterProvider`
- `readBootstrapPayload`
- `renderResolvedMatches`

Today the browser-side analytics client also lives under `~/router/server`, because non-routing framework helpers are grouped there.

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
import { createRouter, readBootstrapPayload } from '~/router'

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
- `matches`, where each match includes `hydration`

## `RouterProvider`

Provides the router to the application.

This is now mostly an internal runtime helper used when VorzelaJs hydrates individual route islands. Typical application entry points should call `router.init()` and let the runtime manage island hydration automatically.

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
- works before and after island hydration because the runtime also installs delegated document-level navigation
- respects modifier keys and `_blank`
- falls through for external URLs

## `hydration`

`hydration` is a route option on `createRootRoute()` and `createFileRoute()`.

Supported values:

- `auto`
- `client`
- `static`

Use it to override the generated route hydration analysis when a route should definitely hydrate or definitely stay static.

```tsx
import { createFileRoute } from '~/router'

export const Route = createFileRoute('/docs')({
  hydration: 'static',
  component: DocsPage,
})
```

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

Available read helpers:

- `filterSearch.readArray(search, key)`
- `filterSearch.readBoolean(search, key, fallback?)`
- `filterSearch.readPage(search, key?, defaultPage?)`
- `filterSearch.readSort(search, key, allowedValues, fallback)`
- `filterSearch.readText(search, key, fallback?)`

Available write helpers:

- `filterSearch.array(values)`
- `filterSearch.boolean(value, { keepFalse? })`
- `filterSearch.page(value, defaultPage?)`
- `filterSearch.sort(value, defaultValue?)`
- `filterSearch.text(value)`

Behavior notes:

- empty arrays become `undefined`, which removes the query param
- `filterSearch.boolean(false)` removes the param by default
- `filterSearch.boolean(false, { keepFalse: true })` preserves an explicit `false`
- `filterSearch.page(value, 1)` removes page `1` by default so canonical URLs stay shorter

```tsx
const explicitFalse = filterSearch.boolean(false, { keepFalse: true })
const hiddenDefaultPage = filterSearch.page(1)
```

### Example: Filters with a Backend API

A common pattern is keeping filter state in the URL and forwarding it to a backend API in the route loader. The loader runs on the server during SSR and on client navigations, so the API call always reflects the current query params.

```tsx
// src/routes/products.server.ts
// Server-only helper — never ships to the browser.

export type ProductFilters = {
  category: string[]
  inStock: boolean
  page: number
  q: string
  sort: 'price' | 'rating' | 'newest'
}

export type ProductsResponse = {
  products: { id: string; name: string; price: number }[]
  totalPages: number
}

export async function fetchProducts(filters: ProductFilters): Promise<ProductsResponse> {
  const url = new URL('https://api.example.com/v1/products')

  if (filters.q) url.searchParams.set('q', filters.q)
  if (filters.inStock) url.searchParams.set('in_stock', 'true')
  if (filters.sort !== 'newest') url.searchParams.set('sort', filters.sort)
  if (filters.page > 1) url.searchParams.set('page', String(filters.page))
  for (const cat of filters.category) url.searchParams.append('category', cat)

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Products API returned ${res.status}`)
  return res.json()
}
```

```tsx
// src/routes/products.tsx
import { createFileRoute, filterSearch, useNavigate } from '~/router'
import type { RouteComponentProps } from '~/router'

import { fetchProducts } from './products.server'
import type { ProductFilters, ProductsResponse } from './products.server'

const SORT_OPTIONS = ['price', 'rating', 'newest'] as const

// 1. Validate and normalize search params from the URL.
//    validateSearch runs on every navigation before the loader.
export const Route = createFileRoute('/products')<ProductsResponse>({
  validateSearch: (search): ProductFilters => ({
    category: filterSearch.readArray(search, 'category'),
    inStock: filterSearch.readBoolean(search, 'in_stock'),
    page: filterSearch.readPage(search, 'page'),
    q: filterSearch.readText(search, 'q'),
    sort: filterSearch.readSort(search, 'sort', SORT_OPTIONS, 'newest'),
  }),

  // 2. Forward the validated filters to the backend API.
  //    `search` is the typed output of validateSearch.
  loader: async ({ search }) => fetchProducts(search),

  head: () => ({
    title: 'Products',
  }),
  component: ProductsPage,
})

function ProductsPage(props: RouteComponentProps<'/products', ProductsResponse>) {
  const search = Route.useSearch()
  const setSearch = Route.useSetSearch()

  // Helper that merges partial filter updates into the current search,
  // resets to page 1, and replaces the history entry.
  const applyFilters = (patch: Partial<ProductFilters>) => {
    const current = search()
    void setSearch({
      category: filterSearch.array(patch.category ?? current.category),
      in_stock: filterSearch.boolean(patch.inStock ?? current.inStock),
      page: filterSearch.page(patch.page ?? 1),
      q: filterSearch.text(patch.q ?? current.q),
      sort: filterSearch.sort(patch.sort ?? current.sort, 'newest'),
    }, { replace: true })
  }

  const toggleCategory = (cat: string) => {
    const cats = search().category
    applyFilters({
      category: cats.includes(cat) ? cats.filter((c) => c !== cat) : [...cats, cat],
    })
  }

  return (
    <section>
      <input
        type="search"
        value={search().q}
        onInput={(e) => applyFilters({ q: e.currentTarget.value })}
        placeholder="Search products…"
      />

      <button onClick={() => toggleCategory('shoes')}>Shoes</button>
      <button onClick={() => toggleCategory('hats')}>Hats</button>

      <button onClick={() => applyFilters({ inStock: !search().inStock })}>
        {search().inStock ? 'Show all' : 'In stock only'}
      </button>

      <ul>
        {props.loaderData.products.map((p) => (
          <li>{p.name} — ${p.price}</li>
        ))}
      </ul>

      <button
        disabled={search().page <= 1}
        onClick={() => applyFilters({ page: search().page - 1 })}
      >
        Previous
      </button>
      <span>Page {search().page} / {props.loaderData.totalPages}</span>
      <button
        disabled={search().page >= props.loaderData.totalPages}
        onClick={() => applyFilters({ page: search().page + 1 })}
      >
        Next
      </button>
    </section>
  )
}
```

Key points:

- `validateSearch` normalizes raw query params into typed filters before the loader runs
- The loader receives the validated `search` and passes it straight to the API helper
- The `.server.ts` helper is tree-shaken from the client bundle
- `setSearch` merges the new values into the URL — other params are preserved
- Setting `page` back to `1` on filter changes avoids empty-page results
- Because the URL is the source of truth, the filtered view is always shareable and SSR-friendly

## `createCookie`

Creates a server-side cookie helper that can parse, sign, serialize, and destroy cookies.

```tsx
import { createCookie, cookiePolicies } from '~/router/server'

const sessionCookie = createCookie('__Host-session', {
  maxAge: 60 * 60 * 24 * 7,
  secrets: ['replace-me'],
})

const apiCookie = createCookie('api-session', cookiePolicies.crossSite({
  httpOnly: true,
}))

const embedCookie = createCookie('__Host-widget', cookiePolicies.partitioned({
  httpOnly: true,
  maxAge: 60 * 60 * 24 * 30,
}))
```

Important behavior:

- `SameSite=None` is automatically upgraded to `Secure`
- `policy: 'partitioned'` automatically sets `Partitioned`, `SameSite=None`, and `Secure`
- `policy: 'cross-site'` automatically sets `SameSite=None` and `Secure`
- `__Host-` and `__Host-Http-` names are forced onto `Path=/` and reject `Domain`

`Partitioned` is useful for isolated third-party cookie state. It is not a replacement for normal same-site subdomain cookies, and it does not remove the need for `credentials: 'include'` on cross-origin requests.

## `cookiePolicies`

Small helpers for common cookie deployment modes.

```tsx
import { cookiePolicies } from '~/router/server'

cookiePolicies.host()
cookiePolicies.crossSite({ httpOnly: true })
cookiePolicies.partitioned({ httpOnly: true, maxAge: 3600 })
```

Use them when you want the framework to apply the right cookie attribute bundle instead of repeating `SameSite=None; Secure` or `Partitioned; Secure` by hand.

## `setCookie` and `deleteCookie`

Append `Set-Cookie` headers to a route response stub or raw `Headers` object.

```tsx
import { createCookie, deleteCookie, setCookie } from '~/router/server'

const sessionCookie = createCookie('__Host-session', { secrets: ['replace-me'] })

export const Route = createFileRoute('/login')({
  loader: async ({ response }) => {
    await setCookie(response, sessionCookie, 'signed-session-value')
    return null
  },
  component: LoginPage,
})

function logout(headers: Headers) {
  return deleteCookie(headers, sessionCookie)
}
```

This is the easiest way to set cookies from `beforeLoad` or `loader`, because VorzelaJs already forwards `response.headers` through document and payload responses.

## `createCookieSessionStorage`

Creates a cookie-backed session storage with `getSession()`, `commitSession()`, and `destroySession()`.

```tsx
import { createCookieSessionStorage } from '~/router/server'

const sessions = createCookieSessionStorage({
  cookie: {
    maxAge: 60 * 60 * 24 * 7,
    name: '__Host-session',
    secrets: ['replace-me'],
  },
})

const session = await sessions.getSession(request.headers.get('Cookie'))
session.set('userId', '42')
const setCookieHeader = await sessions.commitSession(session)
```

Pass either raw cookie options or an already created `VorzelaCookie`.

Current session object methods:

- `get(key)`
- `has(key)`
- `set(key, value)`
- `unset(key)`
- `flash(key, value)`
- `data`

`flash(key, value)` stores a value for one future read. The next `get(key)` consumes that flash entry and removes it from the session.

```tsx
const session = await sessions.getSession(request.headers.get('Cookie'))

session.flash('notice', 'Signed in successfully')
const commitHeader = await sessions.commitSession(session)

const nextRequestSession = await sessions.getSession(request.headers.get('Cookie'))
const notice = nextRequestSession.get<string>('notice')
```

Important constraints:

- this is cookie-backed session storage, not a server-side session database
- session data is JSON serialized into the cookie value, so keep it small
- cookie secrets provide integrity through signing, not confidentiality through encryption

To clear the session cookie entirely:

```tsx
const expiredCookieHeader = await sessions.destroySession(session)
```

## `RouteResponseStub`

`beforeLoad` and `loader` receive `response` with this shape:

```tsx
type RouteResponseStub = {
  headers: Headers
  status: number
}
```

Current behavior:

- `response.headers` is forwarded through both streamed document responses and payload responses
- this is the intended place to append `Set-Cookie` and other route-level headers
- custom `response.status` values are not yet used to override the router's built-in `200` / `404` / `500` status resolution

## `createAnalyticsClient`

Creates a browser-side analytics sender.

```tsx
import { createAnalyticsClient } from '~/router/server'

const analytics = createAnalyticsClient()

analytics.startAutoPageviews()
void analytics.event('signup_clicked', { plan: 'pro' })
```

Current behavior:

- sends events to `/__vorzela/analytics` by default
- uses `navigator.sendBeacon()` when possible
- falls back to `fetch(..., { keepalive: true })`
- stores a visitor id in local storage when available
- stores first-touch and last-touch attribution from UTM parameters and referrer data
- auto pageview mode tracks history `pushState`, `replaceState`, and `popstate`

Key options:

- `endpoint`
- `transport: 'auto' | 'beacon' | 'fetch'`
- `credentials`
- `includeLanguage`
- `includeScreen`
- `includeTimezone`
- `storageKey`, `sessionKey`, `firstTouchKey`, `lastTouchKey`

Current methods:

- `analytics.event(name, properties?, payload?)`
- `analytics.pageview(payload?)`
- `analytics.track(payload)`
- `analytics.startAutoPageviews({ trackInitialPageview? })`

When `transport` is `auto`, `sendBeacon()` is only used for same-origin endpoints without `credentials: 'include'`. Other cases fall back to `fetch(..., { keepalive: true })`.

## `DEFAULT_ANALYTICS_ENDPOINT`

Constant for the built-in analytics route path.

```tsx
import { DEFAULT_ANALYTICS_ENDPOINT } from '~/router/server'

console.log(DEFAULT_ANALYTICS_ENDPOINT)
// '/__vorzela/analytics'
```

## `defineAnalytics`

Defines analytics configuration for the built-in server runtime.

```tsx
import { defineAnalytics } from '~/router/server'

export const analytics = defineAnalytics({
  allowedOrigins: ['https://app.example.com'],
  onEvent: async (event) => {
    console.log(event.attribution.platform, event.attribution.channel)
  },
})
```

Export this from `src/entry-server.tsx` to activate the built-in analytics endpoint.

Current options:

- `allowedOrigins?: string[] | ((origin, request) => boolean)`
- `onEvent?: (event, { payload, request }) => void | Promise<void>`
- `visitorCookie?: false | { name?: string; options?: CookieOptions }`

By default the collector uses a host-scoped `__Host-vrz_aid` visitor cookie with a 90-day max-age. Set `visitorCookie: false` to disable that cookie or override the name and options explicitly.

## `handleAnalyticsRequest`

Parses a browser analytics request into a normalized event shape.

```tsx
import { handleAnalyticsRequest } from '~/router/server'

export async function analyticsHandler(request: Request) {
  return handleAnalyticsRequest(request, {
    onEvent: async (event) => {
      console.log(event)
    },
  })
}
```

Use this when your analytics collector lives in a separate backend API and you still want the same traffic classification logic as the built-in VorzelaJs runtime.

Current response behavior:

- `OPTIONS` requests return `204`
- successful `POST` requests return `204`
- invalid JSON object payloads return `400`
- disallowed origins return `403`
- wrong methods return `405`

## `classifyAnalyticsTraffic`

Classifies a landing URL and referrer into a higher-level traffic channel.

```tsx
import { classifyAnalyticsTraffic } from '~/router/server'

const attribution = classifyAnalyticsTraffic({
  landingUrl: 'https://app.example.com/pricing?utm_source=google&utm_medium=cpc&utm_campaign=spring',
  referrer: 'https://www.google.com/search?q=vorzela',
})
```

The current classifier looks at:

- UTM parameters
- common ad click IDs such as `gclid`, `fbclid`, `msclkid`, and `ttclid`
- known referrer hosts for search engines and social platforms

This is enough for first-party traffic analysis. It is not a substitute for ad-network conversion APIs or browser attribution APIs.

Possible channels today:

- `direct`
- `email`
- `internal`
- `organic-search`
- `organic-social`
- `paid-search`
- `paid-social`
- `referral`
- `unknown`

## `extractAnalyticsTouchPoint`

Convenience helper for turning a landing URL plus optional referrer into the normalized touch-point structure used by the analytics client and server collector.

```tsx
import { extractAnalyticsTouchPoint } from '~/router/server'

const touchPoint = extractAnalyticsTouchPoint(
  'https://app.example.com/pricing?utm_source=google&utm_medium=cpc&utm_campaign=spring',
  'https://www.google.com/search?q=vorzela',
)
```

Use this when you want the normalized attribution object without constructing a full analytics event.

## `defaultRobotsConfig`, `defineRobotsConfig`, and `renderRobotsTxt`

Helpers for dynamic `robots.txt` generation.

```tsx
import { defaultRobotsConfig, defineRobotsConfig, renderRobotsTxt } from '~/router/server'

const robotsConfig = defineRobotsConfig({
  ...defaultRobotsConfig({ siteUrl: 'https://app.example.com' }),
  rules: [
    { userAgent: '*', allow: ['/'] },
    { userAgent: ['GPTBot', 'ClaudeBot'], disallow: ['/'] },
  ],
})

const body = renderRobotsTxt(robotsConfig)
```

Use `robotsConfig` as an export from `src/entry-server.tsx` when you want the built-in runtime to serve custom robots rules. `defaultRobotsConfig()` allows normal crawlers, blocks known AI training crawlers, and advertises `sitemap.xml` when a site URL is provided.

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

It runs on the client after a successful route commit is visible and any matched route islands have hydrated.

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

The SSR runtime can also call `renderResolvedMatches(state, { wrapHydrationBoundaries: true })` to emit island root markers around client-hydrated route branches.

Typical application routes do not need to call this directly.

## Exported Types

Types from `~/router`:

- `BootstrapPayload`
- `GeneratedRouteHydrationRecord`
- `HeadObject`
- `NavigateToOptions`
- `NotFoundState`
- `RenderAssets`
- `ResolvedRouteHydration`
- `RouteAfterLoadContext`
- `RouteBeforeLoadContext`
- `RouteComponentProps`
- `RouteErrorContext`
- `RouteErrorData`
- `RouteErrorState`
- `RouteHydrationMode`
- `RouteLocation`
- `RouteNavigationEnvelope`
- `RouteParams`
- `RoutePayloadEnvelope`
- `RouteRedirectData`
- `RouteRedirectEnvelope`
- `RouteResponseStub`
- `RouteSearch`
- `RouteSearchInput`
- `RouteSearchUpdater`
- `RouterCreateOptions`
- `SetSearchFunction`
- `SetSearchOptions`
- `SitemapEntry`

Types from `~/router/server`:

- `AnalyticsClient`
- `AnalyticsClientContext`
- `AnalyticsClientOptions`
- `AnalyticsClientPayload`
- `AnalyticsDefinition`
- `AnalyticsEvent`
- `AnalyticsEventType`
- `AnalyticsGeoSummary`
- `AnalyticsTouchPoint`
- `AnalyticsTrafficChannel`
- `AnalyticsUserAgentSummary`
- `CookieHeaderTarget`
- `CookieOptions`
- `CookiePolicy`
- `RobotsConfig`
- `RobotsRule`
- `SessionData`
- `SessionStorage`
- `VorzelaCookie`
- `VorzelaSession`

## Notes on Missing APIs

The current router does not export:

- action helpers
- preload helpers
- parentheses-group helpers
- typed status helper constructors for structured 400/500 families