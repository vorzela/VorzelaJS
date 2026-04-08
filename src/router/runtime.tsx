import { ErrorBoundary, createContext, createEffect, createSignal, onCleanup, splitProps, useContext } from 'solid-js'

import { syncHead } from './head'
import { isRedirect } from './navigation'
import { normalizeHref } from './path'
import { parseSearchString, resolveMergedSearch, resolveNavigateHref } from './search'
import {
  materializeBootstrapPayload,
  materializePayloadEnvelope,
  resolveRoute,
} from './resolve'

import type {
  BootstrapPayload,
  NavigateToOptions,
  ResolvedMatch,
  ResolvedRouteState,
  RouteAfterLoadContext,
  RouterCreateOptions,
  RouteComponentProps,
  RouteErrorContext,
  RouteErrorData,
  RouteLocation,
  RoutePayloadEnvelope,
  RouteSearch,
  SetSearchFunction,
  SetSearchOptions,
} from './types'
import type { Accessor, Component, JSX } from 'solid-js'

type NavigationOptions = {
  force?: boolean
  replace?: boolean
  scroll?: boolean
}

export interface VorzelaRouter {
  context: Record<string, unknown>
  init: () => Promise<void>
  navigate: (to: string | NavigateToOptions, options?: NavigationOptions) => Promise<void>
  setSearch: SetSearchFunction
  state: Accessor<ResolvedRouteState>
}

const RouterContext = createContext<VorzelaRouter>()
const OutletContext = createContext<JSX.Element>()
const MatchContext = createContext<ResolvedMatch>()

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
  return (
    <section class="page-card page-card--centered">
      <p class="eyebrow">{props.error.status}</p>
      <h1>Route failed</h1>
      <p class="lead-copy">{props.error.message}</p>
      <p class="mono-note">phase: {props.error.phase}</p>
      <button type="button" class="button button--secondary" onClick={props.reset}>
        Try again
      </button>
    </section>
  )
}

function createRenderError(error: unknown): RouteErrorData {
  if (error instanceof Error) {
    return {
      message: error.message || 'Unexpected render error',
      name: error.name || 'Error',
      phase: 'render',
      status: 500,
    }
  }

  return {
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

function reportAfterLoadError(match: ResolvedMatch, error: unknown) {
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

  const navigate = async (to: string | NavigateToOptions, options: NavigationOptions = {}) => {
    const currentState = state()
    const href = typeof to === 'string'
      ? normalizeHref(to)
      : resolveNavigateHref(
          `${currentState.pathname}${currentState.search}`,
          to,
          parseSearchString(currentState.search),
        )
    const replace = typeof to === 'string' ? options.replace : to.replace ?? options.replace
    const scroll = typeof to === 'string' ? options.scroll : to.scroll ?? options.scroll

    if (!options.force && href === `${currentState.pathname}${currentState.search}`) {
      return
    }

    let nextState: ResolvedRouteState

    try {
      nextState = await resolveRoute(href, { context })
    } catch (error) {
      if (isRedirect(error)) {
        await navigate(error.to, {
          force: true,
          replace: error.replace,
          scroll,
        })
        return
      }

      throw error
    }

    const leaf = nextState.matches[nextState.matches.length - 1]

    if (leaf?.mode === 'server-payload' && typeof window !== 'undefined') {
      const response = await fetch(`/__vorzela/payload?path=${encodeURIComponent(href)}`, {
        headers: {
          'X-Vorzela-Navigation': 'payload',
        },
      })

      let payload: RoutePayloadEnvelope

      try {
        payload = await response.json() as RoutePayloadEnvelope
      } catch (error) {
        throw new Error(`Failed to parse route payload for ${href}: ${(error as Error).message}`)
      }

      if (!response.ok && !payload.html) {
        throw new Error(`Failed to fetch route payload for ${href}`)
      }

      const materialized = await materializePayloadEnvelope(payload)
      commitState(materialized, setState, {
        ...options,
        replace,
        scroll,
      })
      return
    }

    commitState(nextState, setState, {
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
    commitState(nextState, setState, { force: true, replace: true, scroll: false })

    if (!initialized && typeof window !== 'undefined') {
      window.addEventListener('popstate', () => {
        void navigate(`${window.location.pathname}${window.location.search}`, {
          force: true,
          replace: true,
          scroll: false,
        })
      })
      initialized = true
    }
  }

  return {
    context,
    init,
    navigate,
    setSearch,
    state,
  }
}

function PayloadOutlet(props: { html: string }) {
  return <div class="payload-fragment" innerHTML={props.html} />
}

type RenderResolvedMatchesOptions = {
  onRenderError?: (error: RouteErrorData) => void
  retry?: () => void
}

export function renderResolvedMatches(
  state: Pick<ResolvedRouteState, 'matches' | 'notFound' | 'payloadHtml' | 'renderSource' | 'routeError'>,
  options: RenderResolvedMatchesOptions = {},
): JSX.Element {
  const renderAt = (index: number): JSX.Element => {
    const currentMatch = state.matches[index]
    const notFoundHandlerMatch = state.notFound?.handlerId
      ? state.matches.find((match) => match.id === state.notFound?.handlerId)
      : undefined
    const routeErrorHandlerMatch = state.routeError?.handlerId
      ? state.matches.find((match) => match.id === state.routeError?.handlerId)
      : undefined

    if (state.notFound && currentMatch.id === state.notFound.targetId) {
      const NotFoundComponent = notFoundHandlerMatch?.route.options.notFoundComponent
        ?? DefaultNotFoundComponent

      return (
        <MatchContext.Provider value={currentMatch}>
          <NotFoundComponent />
        </MatchContext.Provider>
      )
    }

    if (state.routeError && currentMatch.id === state.routeError.targetId) {
      const errorComponent = routeErrorHandlerMatch?.route.options.errorComponent as Component<RouteErrorContext> | undefined

      return (
        <MatchContext.Provider value={currentMatch}>
          <RouteErrorView
            error={state.routeError.error}
            errorComponent={errorComponent}
            reset={options.retry ?? (() => undefined)}
          />
        </MatchContext.Provider>
      )
    }

    if (
      index === state.matches.length - 1
      && state.renderSource === 'payload'
      && state.payloadHtml
    ) {
      return <PayloadOutlet html={state.payloadHtml} />
    }

    const RouteComponent = currentMatch.route.options.component as Component<RouteComponentProps>
    const errorComponent = currentMatch.route.options.errorComponent as Component<RouteErrorContext> | undefined
    const outlet = index === state.matches.length - 1 ? null : renderAt(index + 1)

    return (
      <MatchContext.Provider value={currentMatch}>
        <OutletContext.Provider value={outlet ?? undefined}>
          <ErrorBoundary fallback={(error, reset) => {
            const routeError = createRenderError(error)
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
  const router = useContext(RouterContext)

  if (!router) {
    throw new Error('useRouter must be used inside a <RouterProvider>')
  }

  return router
}

export function useNavigate() {
  const router = useContext(RouterContext)

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
  const router = useContext(RouterContext)

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
  const router = useContext(RouterContext)
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
  const router = useContext(RouterContext)
  const [local, rest] = splitProps(props, ['children', 'onClick', 'replace', 'to'])
  const onClick = local.onClick as JSX.EventHandler<HTMLAnchorElement, MouseEvent> | undefined

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

  return (
    <a
      {...rest}
      href={local.to}
      onClick={handleClick}
    >
      {local.children}
    </a>
  )
}