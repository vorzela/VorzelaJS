import { parseErrorStack } from '../debug/error-stack'
import { routeHydrationManifest } from '../routeHydration.gen'
import { routeManifest } from '../routeTree.gen'
import { mergeHeads } from './head'
import { isNotFound, isRedirect } from './navigation'
import { buildRouteBranch, matchPathPattern, normalizePath } from './path'
import type {
  AnyRouteDefinition,
  BootstrapPayload,
  GeneratedRouteHydrationRecord,
  GeneratedRouteRecord,
  HeadObject,
  ResolvedMatch,
  ResolvedRouteHydration,
  ResolvedRouteState,
  RouteErrorData,
  RouteErrorPhase,
  RouteErrorState,
  RouteLocation,
  RoutePayloadEnvelope,
  RouterContextValue,
  RouteResponseStub,
  RouteSearch,
  SerializedMatch,
} from './types'

function createResponseStub(): RouteResponseStub {
  return {
    headers: new Headers(),
    status: 200,
  }
}

function createClientRequest(pathname: string) {
  if (typeof window === 'undefined') {
    return new Request(`http://localhost${pathname}`)
  }

  return new Request(new URL(pathname, window.location.origin), {
    headers: {
      'X-Vorzela-Navigation': 'client',
    },
  })
}

function createRouteLocation(target: string, pathname: string, request: Request): RouteLocation {
  const targetUrl = new URL(target, new URL(request.url).origin)

  return {
    href: targetUrl.href,
    pathname,
    search: targetUrl.search,
    searchParams: targetUrl.searchParams,
  }
}

function createRawSearch(searchParams: URLSearchParams): RouteSearch {
  const rawSearch: RouteSearch = {}

  for (const key of new Set(searchParams.keys())) {
    const values = searchParams.getAll(key)
    rawSearch[key] = values.length <= 1 ? values[0] : values
  }

  return rawSearch
}

function selectBestMatch(pathname: string) {
  return routeManifest
    .filter((entry) => entry.id !== '__root__' && entry.matchPath !== null)
    .map((entry) => ({
      entry,
      result: matchPathPattern(entry.matchPath!, pathname),
    }))
    .filter((candidate) => candidate.result.matched)
    .sort((left, right) => {
      if (left.result.score !== right.result.score) {
        return right.result.score - left.result.score
      }

      return right.entry.fullPath.length - left.entry.fullPath.length
    })[0]
}

async function loadRouteDefinition(entry: GeneratedRouteRecord) {
  const module = await entry.loadRoute()
  return module.Route as AnyRouteDefinition
}

function resolveNotFoundHandlerId(
  loadedEntries: Array<{ entry: GeneratedRouteRecord; route: AnyRouteDefinition }>,
) {
  for (let index = loadedEntries.length - 1; index >= 0; index -= 1) {
    const candidate = loadedEntries[index]

    if (candidate.route.options.notFoundComponent) {
      return candidate.entry.id
    }
  }

  return null
}

function resolveErrorHandlerId(
  loadedEntries: Array<{ entry: GeneratedRouteRecord; route: AnyRouteDefinition }>,
) {
  for (let index = loadedEntries.length - 1; index >= 0; index -= 1) {
    const candidate = loadedEntries[index]

    if (candidate.route.options.errorComponent) {
      return candidate.entry.id
    }
  }

  return null
}

function createRouteErrorData(error: unknown, phase: RouteErrorPhase): RouteErrorData {
  const debug = process.env.NODE_ENV !== 'production'
    ? parseErrorStack(error)
    : undefined

  if (error instanceof Error) {
    return {
      debug,
      message: error.message || 'Unexpected route error',
      name: error.name || 'Error',
      phase,
      status: 500,
    }
  }

  return {
    debug,
    message: typeof error === 'string' ? error : 'Unexpected route error',
    name: 'Error',
    phase,
    status: 500,
  }
}

function createRouteErrorState(
  loadedEntries: Array<{ entry: GeneratedRouteRecord; route: AnyRouteDefinition }>,
  targetId: string,
  error: unknown,
  phase: RouteErrorPhase,
): RouteErrorState {
  return {
    handlerId: resolveErrorHandlerId(loadedEntries),
    targetId,
    error: createRouteErrorData(error, phase),
  }
}

function resolveMatchHydration(
  entry: GeneratedRouteRecord,
  route: AnyRouteDefinition,
): ResolvedRouteHydration {
  const hydrationManifest = routeHydrationManifest as Record<string, GeneratedRouteHydrationRecord>
  const detected = hydrationManifest[entry.id]?.detected ?? 'static'
  const configured = route.options.hydration ?? 'auto'

  return configured === 'auto' ? detected : configured
}

function createResolvedMatch(
  entry: GeneratedRouteRecord,
  route: AnyRouteDefinition,
  params: Record<string, string>,
  loaderData: unknown,
  search: unknown,
): ResolvedMatch {
  return {
    fullPath: entry.fullPath,
    hydration: resolveMatchHydration(entry, route),
    id: entry.id,
    loaderData,
    params,
    route,
    search,
  }
}

function validateRouteSearch(route: AnyRouteDefinition, rawSearch: RouteSearch) {
  return route.options.validateSearch
    ? route.options.validateSearch(rawSearch)
    : rawSearch
}

async function materializeMatches(matches: SerializedMatch[]): Promise<ResolvedMatch[]> {
  const routesById = new Map<string, GeneratedRouteRecord>(
    routeManifest.map((entry) => [entry.id, entry]),
  )

  return Promise.all(matches.map(async (match) => {
    const entry = routesById.get(match.id)

    if (!entry) {
      throw new Error(`Unknown route id: ${match.id}`)
    }

    return {
      ...match,
      route: await loadRouteDefinition(entry),
    }
  }))
}

export async function resolveRoute(
  target: string,
  options: {
    context?: RouterContextValue
    request?: Request
  } = {},
): Promise<ResolvedRouteState> {
  const normalized = normalizePath(target)
  const request = options.request ?? createClientRequest(target)
  const responseStub = createResponseStub()
  const context = options.context ?? {}
  const location = createRouteLocation(target, normalized, request)
  const rawSearch = createRawSearch(location.searchParams)
  const bestMatch = selectBestMatch(normalized)

  if (!bestMatch) {
    const rootEntry = routeManifest.find((entry) => entry.id === '__root__')

    if (!rootEntry) {
      throw new Error(`No route matched ${normalized}`)
    }

    const rootRoute = await loadRouteDefinition(rootEntry)
    let rootSearch: unknown = rawSearch

    if (rootRoute.options.validateSearch) {
      try {
        rootSearch = validateRouteSearch(rootRoute, rawSearch)
      } catch (error) {
        if (isRedirect(error)) {
          throw error
        }

        if (isNotFound(error)) {
          return {
            head: mergeHeads([]),
            matches: [
              createResolvedMatch(rootEntry, rootRoute, {}, undefined, rawSearch),
            ],
            notFound: {
              handlerId: rootRoute.options.notFoundComponent ? rootEntry.id : null,
              targetId: rootEntry.id,
            },
            pathname: normalized,
            renderSource: 'component',
            responseHeaders: responseStub.headers,
            search: location.search,
          }
        }

        return {
          head: mergeHeads([]),
          matches: [
            createResolvedMatch(rootEntry, rootRoute, {}, undefined, rawSearch),
          ],
          pathname: normalized,
          renderSource: 'component',
          responseHeaders: responseStub.headers,
          routeError: createRouteErrorState([{ entry: rootEntry, route: rootRoute }], rootEntry.id, error, 'validateSearch'),
          search: location.search,
        }
      }
    }

    const head = rootRoute.options.head
      ? rootRoute.options.head({
          context,
          loaderData: undefined,
          location,
          params: {} as never,
          pathname: normalized,
          search: rootSearch as never,
        })
      : undefined

    return {
      head: mergeHeads([head]),
      matches: [
        createResolvedMatch(rootEntry, rootRoute, {}, undefined, rootSearch),
      ],
      notFound: {
        handlerId: rootRoute.options.notFoundComponent ? rootEntry.id : null,
        targetId: rootEntry.id,
      },
      pathname: normalized,
      renderSource: 'component',
      responseHeaders: responseStub.headers,
      search: location.search,
    }
  }

  const branchEntries = buildRouteBranch(routeManifest, bestMatch.entry.id)
  const accumulatedHeads: HeadObject[] = []
  const matches: ResolvedMatch[] = []
  const loadedEntries: Array<{ entry: GeneratedRouteRecord; route: AnyRouteDefinition }> = []

  for (const entry of branchEntries) {
    const route = await loadRouteDefinition(entry)
    const params = bestMatch.result.params
    loadedEntries.push({ entry, route })

    let validatedSearch: unknown = rawSearch

    if (route.options.validateSearch) {
      try {
        validatedSearch = validateRouteSearch(route, rawSearch)
      } catch (error) {
        if (isRedirect(error)) {
          throw error
        }

        if (isNotFound(error)) {
          matches.push(createResolvedMatch(entry, route, params, undefined, rawSearch))

          return {
            head: mergeHeads(accumulatedHeads),
            matches,
            notFound: {
              handlerId: resolveNotFoundHandlerId(loadedEntries),
              targetId: entry.id,
            },
            pathname: normalized,
            renderSource: 'component',
            responseHeaders: responseStub.headers,
            search: location.search,
          }
        }

        matches.push(createResolvedMatch(entry, route, params, undefined, rawSearch))

        return {
          head: mergeHeads(accumulatedHeads),
          matches,
          pathname: normalized,
          renderSource: 'component',
          responseHeaders: responseStub.headers,
          routeError: createRouteErrorState(loadedEntries, entry.id, error, 'validateSearch'),
          search: location.search,
        }
      }
    }

    if (route.options.beforeLoad) {
      try {
        const beforeLoadResult = await route.options.beforeLoad({
          context,
          location,
          params: params as never,
          pathname: normalized,
          request,
          response: responseStub,
          search: validatedSearch as never,
        })

        if (isRedirect(beforeLoadResult) || isNotFound(beforeLoadResult)) {
          throw beforeLoadResult
        }
      } catch (error) {
        if (isRedirect(error)) {
          throw error
        }

        if (isNotFound(error)) {
          matches.push(createResolvedMatch(entry, route, params, undefined, validatedSearch))

          return {
            head: mergeHeads(accumulatedHeads),
            matches,
            notFound: {
              handlerId: resolveNotFoundHandlerId(loadedEntries),
              targetId: entry.id,
            },
            pathname: normalized,
            renderSource: 'component',
            responseHeaders: responseStub.headers,
            search: location.search,
          }
        }

        matches.push(createResolvedMatch(entry, route, params, undefined, validatedSearch))

        return {
          head: mergeHeads(accumulatedHeads),
          matches,
          pathname: normalized,
          renderSource: 'component',
          responseHeaders: responseStub.headers,
          routeError: createRouteErrorState(loadedEntries, entry.id, error, 'beforeLoad'),
          search: location.search,
        }
      }
    }

    let loaderData: unknown

    if (route.options.loader) {
      try {
        loaderData = await route.options.loader({
          context,
          location,
          params: params as never,
          pathname: normalized,
          request,
          response: responseStub,
          search: validatedSearch as never,
        })
      } catch (error) {
        if (isRedirect(error)) {
          throw error
        }

        if (isNotFound(error)) {
          matches.push(createResolvedMatch(entry, route, params, undefined, validatedSearch))

          return {
            head: mergeHeads(accumulatedHeads),
            matches,
            notFound: {
              handlerId: resolveNotFoundHandlerId(loadedEntries),
              targetId: entry.id,
            },
            pathname: normalized,
            renderSource: 'component',
            responseHeaders: responseStub.headers,
            search: location.search,
          }
        }

        matches.push(createResolvedMatch(entry, route, params, undefined, validatedSearch))

        return {
          head: mergeHeads(accumulatedHeads),
          matches,
          pathname: normalized,
          renderSource: 'component',
          responseHeaders: responseStub.headers,
          routeError: createRouteErrorState(loadedEntries, entry.id, error, 'loader'),
          search: location.search,
        }
      }
    }

    let head: HeadObject | undefined

    if (route.options.head) {
      try {
        head = route.options.head({
          context,
          loaderData,
          location,
          params: params as never,
          pathname: normalized,
          search: validatedSearch as never,
        })

        if (head) {
          accumulatedHeads.push(head)
        }
      } catch (error) {
        matches.push(createResolvedMatch(entry, route, params, loaderData, validatedSearch))

        return {
          head: mergeHeads(accumulatedHeads),
          matches,
          pathname: normalized,
          renderSource: 'component',
          responseHeaders: responseStub.headers,
          routeError: createRouteErrorState(loadedEntries, entry.id, error, 'render'),
          search: location.search,
        }
      }
    }

    matches.push(createResolvedMatch(entry, route, params, loaderData, validatedSearch))
  }

  return {
    head: mergeHeads(accumulatedHeads),
    matches,
    pathname: normalized,
    renderSource: 'component',
    responseHeaders: responseStub.headers,
    search: location.search,
  }
}

export function serializeRouteState(state: ResolvedRouteState): BootstrapPayload {
  return {
    head: state.head,
    matches: state.matches.map((match) => ({
      fullPath: match.fullPath,
      hydration: match.hydration,
      id: match.id,
      loaderData: match.loaderData,
      params: match.params,
      search: match.search,
    })),
    notFound: state.notFound,
    pathname: state.pathname,
    routeError: state.routeError,
    search: state.search,
  }
}

export async function materializeBootstrapPayload(payload: BootstrapPayload): Promise<ResolvedRouteState> {
  return {
    head: payload.head,
    matches: await materializeMatches(payload.matches),
    notFound: payload.notFound,
    pathname: payload.pathname,
    renderSource: 'component',
    routeError: payload.routeError,
    search: payload.search,
  }
}

export async function materializePayloadEnvelope(payload: RoutePayloadEnvelope): Promise<ResolvedRouteState> {
  return {
    head: payload.head,
    matches: await materializeMatches(payload.matches),
    notFound: payload.notFound,
    pathname: payload.pathname,
    payloadHtml: payload.html,
    renderSource: 'payload',
    routeError: payload.routeError,
    search: payload.search,
  }
}

export function getResolvedRouteStatus(state: Pick<ResolvedRouteState, 'matches' | 'notFound' | 'routeError'>) {
  if (state.routeError) {
    return state.routeError.error.status
  }

  if (state.notFound) {
    return 404
  }

  const leaf = state.matches[state.matches.length - 1]
  return leaf?.id === '/$' || leaf?.id.endsWith('/$') ? 404 : 200
}

export function isNotFoundState(state: ResolvedRouteState) {
  if (state.notFound) {
    return true
  }

  const leaf = state.matches[state.matches.length - 1]
  return leaf?.id === '/$' || leaf?.id.endsWith('/$')
}