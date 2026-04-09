import type { Accessor, Component, JSX } from 'solid-js'
import { createContext, createEffect, createSignal, ErrorBoundary, onCleanup, sharedConfig, splitProps, useContext } from 'solid-js'
import { hydrate } from 'solid-js/web'

import { formatParsedStack, parseErrorStack } from '../debug/error-stack.js'
import { syncHead } from './head.js'
import { normalizeHref } from './path.js'
import {
  materializeBootstrapPayload,
  materializePayloadEnvelope,
} from './resolve.js'
import { parseSearchString, resolveMergedSearch, resolveNavigateHref } from './search.js'
import type {
  BootstrapPayload,
  NavigateToOptions,
  ResolvedMatch,
  ResolvedRouteState,
  RouteAfterLoadContext,
  RouteComponentProps,
  RouteErrorContext,
  RouteErrorData,
  RouteLocation,
  RouteNavigationEnvelope,
  RoutePayloadEnvelope,
  RouterCreateOptions,
  RouteRedirectData,
  RouteSearch,
  SetSearchFunction,
  SetSearchOptions,
} from './types.js'

type NavigationOptions = {
  force?: boolean
  replace?: boolean
  scroll?: boolean
}

type NavigationResult = ResolvedRouteState | RouteRedirectData

type PrefetchCacheEntry = {
  createdAt: number
  promise: Promise<NavigationResult>
}

const PREFETCH_CACHE_MAX_ENTRIES = 24
const PREFETCH_CACHE_TTL_MS = 30_000
const isDev = import.meta.env.DEV

export interface VorzelaRouter {
  context: Record<string, unknown>
  init: () => Promise<void>
  navigate: (to: string | NavigateToOptions, options?: NavigationOptions) => Promise<void>
  prefetch: (to: string | NavigateToOptions) => Promise<void>
  setSearch: SetSearchFunction
  state: Accessor<ResolvedRouteState>
}

const RouterContext = createContext<VorzelaRouter>()
const OutletContext = createContext<JSX.Element>()
const MatchContext = createContext<ResolvedMatch>()
const ISLAND_ROOT_ATTRIBUTE = 'data-vrz-island-root'
const ISLAND_CONTEXT_ATTRIBUTE = 'data-vrz-hctx'
const RETRY_ATTRIBUTE = 'data-vrz-retry'

let _activeRouter: VorzelaRouter | undefined

function formatMatchChain(matches: Pick<ResolvedMatch, 'id' | 'hydration'>[]) {
  return matches.map((match) => `${match.id}:${match.hydration}`).join(' > ')
}

function logDevRouterEvent(label: string, details: Record<string, unknown>) {
  if (!isDev || typeof window === 'undefined') {
    return
  }

  console.info(`[VorzelaJs][router] ${label}`, details)
}

function logDevRouterError(scope: string, error: unknown, meta: Record<string, unknown> = {}) {
  if (!isDev || typeof window === 'undefined') {
    return
  }

  const parsedStack = parseErrorStack(error)

  console.groupCollapsed(`[VorzelaJs][router:${scope}] ${error instanceof Error ? error.message : 'Unexpected error'}`)
  console.info(meta)

  if (parsedStack) {
    const lines = formatParsedStack(parsedStack)

    if (lines.length > 0) {
      console.info(lines.join('\n'))
    }
  }

  console.error(error)
  console.groupEnd()
}

function prunePrefetchCache(prefetchCache: Map<string, PrefetchCacheEntry>) {
  const now = Date.now()

  for (const [href, entry] of prefetchCache) {
    if (now - entry.createdAt > PREFETCH_CACHE_TTL_MS) {
      prefetchCache.delete(href)
    }
  }

  while (prefetchCache.size > PREFETCH_CACHE_MAX_ENTRIES) {
    const oldestKey = prefetchCache.keys().next().value

    if (!oldestKey) {
      break
    }

    prefetchCache.delete(oldestKey)
  }
}

function commitState(
  nextState: ResolvedRouteState,
  setState: (value: ResolvedRouteState) => void,
  options: NavigationOptions = {},
) {
  setState(nextState)
  syncHead(nextState.head)

  if (typeof window === 'undefined') return

  const href = `${nextState.pathname}${nextState.search}`

  if (options.replace) {
    window.history.replaceState({}, '', href)
  } else if (!options.force) {
    window.history.pushState({}, '', href)
  }

  if (options.scroll !== false) {
    window.scrollTo({ left: 0, top: 0 })
  }
}

function DefaultNotFoundComponent() {
  return (
    <div class="page-card page-card--centered">
      <p class="eyebrow">404</p>
      <h1>Page not found</h1>
      <p class="lead-copy">The requested route could not be resolved.</p>
    </div>
  )
}

function DefaultRouteErrorComponent(props: RouteErrorContext) {
  const debugLines = () => formatParsedStack(props.error.debug)

  return (
    <section class="page-card page-card--centered">
      <p class="eyebrow">{props.error.status}</p>
      <h1>Route failed</h1>
      <p class="lead-copy">{props.error.message}</p>
      <p class="mono-note">phase: {props.error.phase}</p>
      {isDev && debugLines().length > 0 && (
        <details class="mono-note" open>
          <summary>Debug stack</summary>
          <pre>{debugLines().join('\n')}</pre>
        </details>
      )}
      <button type="button" class="button button--secondary" data-vrz-retry="">
        Try again
      </button>
    </section>
  )
}

function createRenderError(error: unknown): RouteErrorData {
  const debug = isDev ? parseErrorStack(error) : undefined

  if (error instanceof Error) {
    return {
      debug,
      message: error.message || 'Unexpected render error',
      name: error.name || 'Error',
      phase: 'render',
      status: 500,
    }
  }

  return {
    debug,
    message: typeof error === 'string' ? error : 'Unexpected render error',
    name: 'Error',
    phase: 'render',
    status: 500,
  }
}

function RouteErrorView(props: {
  error: RouteErrorData
  errorComponent?: Component<RouteErrorContext>
  reset: () => void
}) {
  const ErrorComponent = props.errorComponent

  return ErrorComponent
    ? <ErrorComponent error={props.error} reset={props.reset} />
    : <DefaultRouteErrorComponent error={props.error} reset={props.reset} />
}

function createAfterLoadLocation(pathname: string, search: string): RouteLocation {
  if (typeof window === 'undefined') {
    const url = new URL(`http://localhost${pathname}${search}`)

    return {
      href: url.href,
      pathname,
      search,
      searchParams: url.searchParams,
    }
  }

  const url = new URL(`${pathname}${search}`, window.location.origin)

  return {
    href: url.href,
    pathname,
    search,
    searchParams: url.searchParams,
  }
}

function isHydrationBoundary(state: Pick<ResolvedRouteState, 'matches'>, index: number) {
  const currentMatch = state.matches[index]
  const previousMatch = state.matches[index - 1]

  return currentMatch?.hydration === 'client' && previousMatch?.hydration !== 'client'
}

function canHydrateBoundary(
  state: Pick<ResolvedRouteState, 'matches' | 'notFound' | 'routeError'>,
  startIndex: number,
) {
  const subtreeIds = new Set(state.matches.slice(startIndex).map((match) => match.id))

  if (
    state.notFound
    && subtreeIds.has(state.notFound.targetId)
    && state.notFound.handlerId
    && !subtreeIds.has(state.notFound.handlerId)
  ) {
    return false
  }

  if (
    state.routeError
    && subtreeIds.has(state.routeError.targetId)
    && state.routeError.handlerId
    && !subtreeIds.has(state.routeError.handlerId)
  ) {
    return false
  }

  return true
}

function getHydrationRoots(
  state: Pick<ResolvedRouteState, 'matches' | 'notFound' | 'routeError'>,
) {
  return state.matches.flatMap((match, index) => (
    isHydrationBoundary(state, index) && canHydrateBoundary(state, index)
      ? [{ id: match.id, index }]
      : []
  ))
}

function createHydrationSubtreeState(
  state: ResolvedRouteState,
  startIndex: number,
): Pick<ResolvedRouteState, 'matches' | 'notFound' | 'payloadHtml' | 'renderSource' | 'routeError'> {
  const matches = state.matches.slice(startIndex)
  const subtreeIds = new Set(matches.map((match) => match.id))

  return {
    matches,
    notFound: state.notFound && subtreeIds.has(state.notFound.targetId)
      && (!state.notFound.handlerId || subtreeIds.has(state.notFound.handlerId))
      ? state.notFound
      : undefined,
    payloadHtml: undefined,
    renderSource: 'component',
    routeError: state.routeError && subtreeIds.has(state.routeError.targetId)
      && (!state.routeError.handlerId || subtreeIds.has(state.routeError.handlerId))
      ? state.routeError
      : undefined,
  }
}

function replaceAppHtml(html: string) {
  const app = document.getElementById('app')

  if (!(app instanceof HTMLElement)) {
    throw new Error('Missing VorzelaJs app root')
  }

  app.innerHTML = html
  return app
}

function readIslandHydrationContext(mount: HTMLElement) {
  const raw = mount.getAttribute(ISLAND_CONTEXT_ATTRIBUTE)

  if (!raw) {
    return undefined
  }

  const sep = raw.indexOf(':')

  if (sep < 0) {
    return undefined
  }

  return {
    id: raw.slice(0, sep),
    count: Number(raw.slice(sep + 1)),
  }
}

function isRouteRedirectData(value: unknown): value is RouteRedirectData {
  return typeof value === 'object'
    && value !== null
    && 'to' in value
    && 'replace' in value
    && 'status' in value
}

function isRouteRedirectEnvelope(value: unknown): value is Extract<RouteNavigationEnvelope, { redirect: RouteRedirectData }> {
  return typeof value === 'object'
    && value !== null
    && 'redirect' in value
    && isRouteRedirectData((value as { redirect: unknown }).redirect)
}

function reportAfterLoadError(match: ResolvedMatch, error: unknown) {
  logDevRouterError('afterLoad', error, { routeId: match.id })
  console.error(`[VorzelaJs] afterLoad failed for route ${match.id}`, error)
}

function runAfterLoadHooks(router: VorzelaRouter, state: ResolvedRouteState) {
  if (typeof window === 'undefined' || state.matches.length === 0 || state.notFound || state.routeError) {
    return
  }

  const location = createAfterLoadLocation(state.pathname, state.search)

  for (const match of state.matches) {
    const afterLoad = match.route.options.afterLoad as ((context: RouteAfterLoadContext<string, unknown, RouteSearch>) => Promise<void> | void) | undefined

    if (!afterLoad) {
      continue
    }

    const afterLoadContext = {
      context: router.context,
      loaderData: match.loaderData,
      location,
      params: match.params as never,
      pathname: state.pathname,
      search: match.search as RouteSearch,
    } satisfies RouteAfterLoadContext<string, unknown, RouteSearch>

    try {
      const result = afterLoad(afterLoadContext)
      void Promise.resolve(result).catch((error) => {
        reportAfterLoadError(match, error)
      })
    } catch (error) {
      reportAfterLoadError(match, error)
    }
  }
}

export function createRouter(
  initialPayload: BootstrapPayload,
  options: RouterCreateOptions = {},
): VorzelaRouter {
  const [state, setState] = createSignal<ResolvedRouteState>({
    head: initialPayload.head,
    matches: [],
    notFound: initialPayload.notFound,
    pathname: initialPayload.pathname,
    renderSource: 'component',
    routeError: initialPayload.routeError,
    search: initialPayload.search,
  })
  const context = options.context ?? {}

  let initialized = false
  let afterLoadFrame: number | undefined
  let afterLoadToken = 0
  const islandDisposers: Array<() => void> = []
  const prefetchCache = new Map<string, PrefetchCacheEntry>()

  const resolveTargetHref = (to: string | NavigateToOptions) => {
    const currentState = state()

    return typeof to === 'string'
      ? normalizeHref(to)
      : resolveNavigateHref(
          `${currentState.pathname}${currentState.search}`,
          to,
          parseSearchString(currentState.search),
        )
  }

  const getCachedNavigationState = (href: string) => {
    prunePrefetchCache(prefetchCache)
    return prefetchCache.get(href)?.promise
  }

  const storeNavigationState = (href: string, promise: Promise<NavigationResult>) => {
    prefetchCache.set(href, {
      createdAt: Date.now(),
      promise,
    })
    prunePrefetchCache(prefetchCache)

    return promise
  }

  const disposeHydrationRoots = () => {
    for (const dispose of islandDisposers.splice(0)) {
      dispose()
    }
  }

  const scheduleAfterLoad = (nextState: ResolvedRouteState) => {
    if (typeof window === 'undefined') {
      return
    }

    const token = ++afterLoadToken

    if (afterLoadFrame !== undefined) {
      window.cancelAnimationFrame(afterLoadFrame)
    }

    afterLoadFrame = window.requestAnimationFrame(() => {
      afterLoadFrame = undefined

      if (token !== afterLoadToken) {
        return
      }

      runAfterLoadHooks(router, nextState)
    })
  }

  const hydrateIslands = (nextState: ResolvedRouteState) => {
    if (typeof window === 'undefined') {
      return
    }

    const app = document.getElementById('app')

    if (!(app instanceof HTMLElement)) {
      throw new Error('Missing VorzelaJs app root')
    }

    const mountPoints = Array.from(app.querySelectorAll<HTMLElement>(`[${ISLAND_ROOT_ATTRIBUTE}]`))

    const hydrationRoots = getHydrationRoots(nextState)

    for (const root of hydrationRoots) {
      const mount = mountPoints.find((candidate) => candidate.getAttribute(ISLAND_ROOT_ATTRIBUTE) === root.id)

      if (!mount) {
        continue
      }

      const subtreeState = createHydrationSubtreeState(nextState, root.index)
      const retry = () => {
        void router.navigate(`${router.state().pathname}${router.state().search}`, {
          force: true,
          replace: true,
          scroll: false,
        })
      }

      const hctx = readIslandHydrationContext(mount)

      islandDisposers.push(hydrate(() => {
        if (hctx && sharedConfig.context) {
          sharedConfig.context.count = hctx.count
        }

        return renderResolvedMatches(subtreeState, { retry })
      }, mount, {
        renderId: hctx?.id,
      }))
    }

    logDevRouterEvent('hydrate', {
      islands: hydrationRoots.map((root) => root.id),
      matches: formatMatchChain(nextState.matches),
      pathname: `${nextState.pathname}${nextState.search}`,
    })
  }

  const mountState = (
    nextState: ResolvedRouteState,
    navigationOptions: NavigationOptions = {},
  ) => {
    disposeHydrationRoots()

    if (typeof window !== 'undefined' && nextState.payloadHtml) {
      replaceAppHtml(nextState.payloadHtml)
    }

    commitState(nextState, setState, navigationOptions)
    hydrateIslands(nextState)
    scheduleAfterLoad(nextState)

    if (nextState.payloadHtml) {
      storeNavigationState(
        `${nextState.pathname}${nextState.search}`,
        Promise.resolve(nextState),
      )
    }

    logDevRouterEvent('commit', {
      matches: formatMatchChain(nextState.matches),
      pathname: `${nextState.pathname}${nextState.search}`,
      renderSource: nextState.renderSource,
      routeError: nextState.routeError?.error.message,
    })
  }

  const fetchNavigationState = async (href: string) => {
    const response = await fetch(`/__vorzela/payload?path=${encodeURIComponent(href)}`, {
      credentials: 'same-origin',
      headers: {
        'X-Vorzela-Navigation': 'payload',
      },
      redirect: 'manual',
    })

    let payload: unknown

    try {
      payload = await response.json()
    } catch (error) {
      throw new Error(`Failed to parse route payload for ${href}: ${(error as Error).message}`)
    }

    if (isRouteRedirectEnvelope(payload)) {
      return payload.redirect
    }

    if (
      typeof payload !== 'object'
      || payload === null
      || !('html' in payload)
      || !('matches' in payload)
    ) {
      throw new Error(`Unexpected route payload for ${href}`)
    }

    return materializePayloadEnvelope(payload as RoutePayloadEnvelope)
  }

  const requestNavigationState = (href: string, reason: 'navigate' | 'prefetch') => {
    const cached = getCachedNavigationState(href)

    if (cached) {
      logDevRouterEvent(`${reason}:cache-hit`, { href })
      return cached
    }

    logDevRouterEvent(`${reason}:network`, { href })

    const pending = fetchNavigationState(href).catch((error) => {
      prefetchCache.delete(href)
      throw error
    })

    return storeNavigationState(href, pending)
  }

  const prefetch = async (to: string | NavigateToOptions) => {
    if (typeof window === 'undefined') {
      return
    }

    const href = resolveTargetHref(to)

    if (href === `${state().pathname}${state().search}`) {
      return
    }

    try {
      await requestNavigationState(href, 'prefetch')
    } catch (error) {
      logDevRouterError('prefetch', error, { href })
    }
  }

  const navigate = async (to: string | NavigateToOptions, options: NavigationOptions = {}) => {
    const currentState = state()
    const href = resolveTargetHref(to)
    const replace = typeof to === 'string' ? options.replace : to.replace ?? options.replace
    const scroll = typeof to === 'string' ? options.scroll : to.scroll ?? options.scroll

    if (!options.force && href === `${currentState.pathname}${currentState.search}`) {
      return
    }

    let nextState: NavigationResult

    try {
      nextState = await requestNavigationState(href, 'navigate')
    } catch (error) {
      logDevRouterError('navigate', error, { href })
      throw error
    }

    if (isRouteRedirectData(nextState)) {
      await navigate(nextState.to, {
        force: true,
        replace: nextState.replace,
        scroll,
      })
      return
    }

    mountState(nextState, {
      ...options,
      replace,
      scroll,
    })
  }

  const setSearch: SetSearchFunction = (search, options: SetSearchOptions = {}) => {
    const currentState = state()
    const nextSearch = resolveMergedSearch(
      parseSearchString(currentState.search),
      parseSearchString(currentState.search),
      search,
    )

    return navigate({
      replace: options.replace,
      scroll: options.scroll,
      search: nextSearch,
      to: currentState.pathname,
    })
  }

  const init = async () => {
    const nextState = await materializeBootstrapPayload(initialPayload)
    mountState(nextState, { force: true, replace: true, scroll: false })

    logDevRouterEvent('init', {
      matches: formatMatchChain(nextState.matches),
      pathname: `${nextState.pathname}${nextState.search}`,
    })

    if (!initialized && typeof window !== 'undefined') {
      window.addEventListener('popstate', () => {
        void navigate(`${window.location.pathname}${window.location.search}`, {
          force: true,
          replace: true,
          scroll: false,
        })
      })
      document.addEventListener('click', (event) => {
        if (
          event.defaultPrevented
          || event.button !== 0
          || event.metaKey
          || event.altKey
          || event.ctrlKey
          || event.shiftKey
        ) {
          return
        }

        const target = event.target

        if (!(target instanceof Element)) {
          return
        }

        const retryButton = target.closest(`[${RETRY_ATTRIBUTE}]`)

        if (retryButton instanceof HTMLButtonElement) {
          event.preventDefault()
          void navigate(`${window.location.pathname}${window.location.search}`, {
            force: true,
            replace: true,
            scroll: false,
          })
          return
        }

        const anchor = target.closest('a[href]')

        if (!(anchor instanceof HTMLAnchorElement)) {
          return
        }

        if (anchor.target === '_blank' || anchor.hasAttribute('download')) {
          return
        }

        const nextUrl = new URL(anchor.href, window.location.origin)

        if (nextUrl.origin !== window.location.origin) {
          return
        }

        if (
          nextUrl.hash
          && nextUrl.pathname === window.location.pathname
          && nextUrl.search === window.location.search
        ) {
          return
        }

        event.preventDefault()
        void navigate(`${nextUrl.pathname}${nextUrl.search}`, {
          replace: anchor.hasAttribute('data-vrz-replace'),
        })
      })
      initialized = true
    }
  }

  const router: VorzelaRouter = {
    context,
    init,
    navigate,
    prefetch,
    setSearch,
    state,
  }

  _activeRouter = router

  return router
}

function PayloadOutlet(props: { html: string }) {
  return <div class="payload-fragment" innerHTML={props.html} />
}

type RenderResolvedMatchesOptions = {
  onRenderError?: (error: RouteErrorData) => void
  retry?: () => void
  wrapHydrationBoundaries?: boolean
}

export function renderResolvedMatches(
  state: Pick<ResolvedRouteState, 'matches' | 'notFound' | 'payloadHtml' | 'renderSource' | 'routeError'>,
  options: RenderResolvedMatchesOptions = {},
): JSX.Element {
  const renderAt = (index: number): JSX.Element => {
    const currentMatch = state.matches[index]
    const isIsland = options.wrapHydrationBoundaries && isHydrationBoundary(state, index)
    const captureIslandContext = (): string | undefined =>
      isIsland && sharedConfig.context
        ? `${sharedConfig.context.id}:${sharedConfig.context.count}`
        : undefined
    const notFoundHandlerMatch = state.notFound?.handlerId
      ? state.matches.find((match) => match.id === state.notFound?.handlerId)
      : undefined
    const routeErrorHandlerMatch = state.routeError?.handlerId
      ? state.matches.find((match) => match.id === state.routeError?.handlerId)
      : undefined

    if (state.notFound && currentMatch.id === state.notFound.targetId) {
      const NotFoundComponent = notFoundHandlerMatch?.route.options.notFoundComponent
        ?? DefaultNotFoundComponent

      const islandContext = captureIslandContext()

      const content = (
        <MatchContext.Provider value={currentMatch}>
          <NotFoundComponent />
        </MatchContext.Provider>
      )

      return isIsland
        ? <div data-vrz-island-root={currentMatch.id} data-vrz-hctx={islandContext}>{content}</div>
        : content
    }

    if (state.routeError && currentMatch.id === state.routeError.targetId) {
      const errorComponent = routeErrorHandlerMatch?.route.options.errorComponent as Component<RouteErrorContext> | undefined

      const islandContext = captureIslandContext()

      const content = (
        <MatchContext.Provider value={currentMatch}>
          <RouteErrorView
            error={state.routeError.error}
            errorComponent={errorComponent}
            reset={options.retry ?? (() => undefined)}
          />
        </MatchContext.Provider>
      )

      return isIsland
        ? <div data-vrz-island-root={currentMatch.id} data-vrz-hctx={islandContext}>{content}</div>
        : content
    }

    if (
      index === state.matches.length - 1
      && state.renderSource === 'payload'
      && state.payloadHtml
    ) {
      const islandContext = captureIslandContext()
      const content = <PayloadOutlet html={state.payloadHtml} />

      return isIsland
        ? <div data-vrz-island-root={currentMatch.id} data-vrz-hctx={islandContext}>{content}</div>
        : content
    }

    const RouteComponent = currentMatch.route.options.component as Component<RouteComponentProps>
    const errorComponent = currentMatch.route.options.errorComponent as Component<RouteErrorContext> | undefined
    const outlet = index === state.matches.length - 1 ? null : renderAt(index + 1)
    const islandContext = captureIslandContext()

    const content = (
      <MatchContext.Provider value={currentMatch}>
        <OutletContext.Provider value={outlet ?? undefined}>
          <ErrorBoundary fallback={(error, reset) => {
            const routeError = createRenderError(error)
            logDevRouterError('render', error, {
              routeId: currentMatch.id,
            })
            options.onRenderError?.(routeError)

            return (
              <RouteErrorView
                error={routeError}
                errorComponent={errorComponent}
                reset={reset}
              />
            )
          }}>
            <RouteComponent
              loaderData={currentMatch.loaderData}
              params={currentMatch.params as never}
              search={currentMatch.search as never}
            >
              {outlet}
            </RouteComponent>
          </ErrorBoundary>
        </OutletContext.Provider>
      </MatchContext.Provider>
    )

    return isIsland
      ? <div data-vrz-island-root={currentMatch.id} data-vrz-hctx={islandContext}>{content}</div>
      : content
  }

  if (state.matches.length === 0) {
    return <div class="route-loading">Loading route...</div>
  }

  return renderAt(0)
}

export function RouterProvider(props: { router: VorzelaRouter }) {
  let afterLoadFrame: number | undefined
  let afterLoadToken = 0
  let currentRenderFailed = false

  createEffect(() => {
    const currentState = props.router.state()

    if (typeof window === 'undefined') {
      return
    }

    currentRenderFailed = false

    const currentToken = ++afterLoadToken

    if (afterLoadFrame !== undefined) {
      window.cancelAnimationFrame(afterLoadFrame)
    }

    afterLoadFrame = window.requestAnimationFrame(() => {
      afterLoadFrame = undefined

      if (currentToken !== afterLoadToken) {
        return
      }

      if (currentRenderFailed) {
        return
      }

      runAfterLoadHooks(props.router, currentState)
    })
  })

  onCleanup(() => {
    if (typeof window !== 'undefined' && afterLoadFrame !== undefined) {
      window.cancelAnimationFrame(afterLoadFrame)
    }
  })

  const retry = () => {
    void props.router.navigate(`${props.router.state().pathname}${props.router.state().search}`, {
      force: true,
      replace: true,
      scroll: false,
    })
  }

  return (
    <RouterContext.Provider value={props.router}>
      {renderResolvedMatches(props.router.state(), {
        onRenderError: () => {
          currentRenderFailed = true
        },
        retry,
      })}
    </RouterContext.Provider>
  )
}

export function Outlet() {
  return useContext(OutletContext) ?? null
}

export function useRouter() {
  const router = useContext(RouterContext) ?? _activeRouter

  if (!router) {
    throw new Error('useRouter must be used inside a <RouterProvider>')
  }

  return router
}

export function useNavigate() {
  const router = useContext(RouterContext) ?? _activeRouter

  return (to: string | NavigateToOptions, options?: NavigationOptions) => {
    if (!router) {
      return Promise.reject(new Error('useNavigate cannot be called during SSR'))
    }

    return router.navigate(to, options)
  }
}

export function useParams<T extends Record<string, string> = Record<string, string>>() {
  const match = useContext(MatchContext)

  if (!match) {
    throw new Error('useParams must be used inside a route component')
  }

  return match.params as T
}

export function useLoaderData<T = unknown>() {
  const match = useContext(MatchContext)

  if (!match) {
    throw new Error('useLoaderData must be used inside a route component')
  }

  return match.loaderData as T
}

export function useSearch<T extends RouteSearch = RouteSearch>() {
  const match = useContext(MatchContext)
  const router = useContext(RouterContext) ?? _activeRouter

  if (!match) {
    throw new Error('useSearch must be used inside a route component')
  }

  return () => {
    if (!router) {
      return match.search as T
    }

    const currentMatch = router.state().matches.find((candidate) => candidate.id === match.id)
    return (currentMatch?.search ?? match.search) as T
  }
}

export function useSetSearch<T extends RouteSearch = RouteSearch>(): SetSearchFunction<T> {
  const router = useContext(RouterContext) ?? _activeRouter
  const search = useSearch<T>()

  return (nextSearch, options = {}) => {
    if (!router) {
      return Promise.reject(new Error('useSetSearch cannot be called during SSR'))
    }

    const currentState = router.state()
    const mergedSearch = resolveMergedSearch(
      parseSearchString(currentState.search),
      search(),
      nextSearch,
    )

    return router.navigate({
      replace: options.replace,
      scroll: options.scroll,
      search: mergedSearch,
      to: currentState.pathname,
    })
  }
}

export function readBootstrapPayload(): BootstrapPayload {
  const element = document.getElementById('__VORZELA_DATA__')

  if (!(element instanceof HTMLScriptElement) || !element.textContent) {
    throw new Error('Missing VorzelaJs bootstrap payload')
  }

  return JSON.parse(element.textContent) as BootstrapPayload
}

type LinkProps = JSX.AnchorHTMLAttributes<HTMLAnchorElement> & {
  replace?: boolean
  to: string
}

export function Link(props: LinkProps) {
  const router = useContext(RouterContext) ?? _activeRouter
  const [local, rest] = splitProps(props, ['children', 'onClick', 'onFocus', 'onMouseEnter', 'onTouchStart', 'replace', 'to'])
  const onClick = local.onClick as JSX.EventHandler<HTMLAnchorElement, MouseEvent> | undefined
  const onFocus = local.onFocus as JSX.EventHandler<HTMLAnchorElement, FocusEvent> | undefined
  const onMouseEnter = local.onMouseEnter as JSX.EventHandler<HTMLAnchorElement, MouseEvent> | undefined
  const onTouchStart = local.onTouchStart as JSX.EventHandler<HTMLAnchorElement, TouchEvent> | undefined

  const prefetchLink = () => {
    if (!router) {
      return
    }

    const nextUrl = new URL(local.to, window.location.origin)

    if (nextUrl.origin !== window.location.origin) {
      return
    }

    void router.prefetch(`${nextUrl.pathname}${nextUrl.search}`)
  }

  const handleClick: JSX.EventHandlerUnion<HTMLAnchorElement, MouseEvent> = (event) => {
    onClick?.(event)

    if (
      event.defaultPrevented
      || event.button !== 0
      || event.metaKey
      || event.altKey
      || event.ctrlKey
      || event.shiftKey
      || rest.target === '_blank'
      || !router
    ) {
      return
    }

    const nextUrl = new URL(local.to, window.location.origin)

    if (nextUrl.origin !== window.location.origin) {
      return
    }

    event.preventDefault()
    void router.navigate(`${nextUrl.pathname}${nextUrl.search}`, { replace: local.replace })
  }

  const handleMouseEnter: JSX.EventHandlerUnion<HTMLAnchorElement, MouseEvent> = (event) => {
    onMouseEnter?.(event)

    if (!event.defaultPrevented) {
      prefetchLink()
    }
  }

  const handleFocus: JSX.EventHandlerUnion<HTMLAnchorElement, FocusEvent> = (event) => {
    onFocus?.(event)

    if (!event.defaultPrevented) {
      prefetchLink()
    }
  }

  const handleTouchStart: JSX.EventHandlerUnion<HTMLAnchorElement, TouchEvent> = (event) => {
    onTouchStart?.(event)

    if (!event.defaultPrevented) {
      prefetchLink()
    }
  }

  return (
    <a
      {...rest}
      data-vrz-replace={local.replace ? '' : undefined}
      href={local.to}
      onClick={handleClick}
      onFocus={handleFocus}
      onMouseEnter={handleMouseEnter}
      onTouchStart={handleTouchStart}
    >
      {local.children}
    </a>
  )
}