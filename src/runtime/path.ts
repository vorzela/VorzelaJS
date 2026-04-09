import type { GeneratedRouteRecord } from './types'

function stripHash(value: string) {
  return value.split('#', 1)[0] ?? '/'
}

function splitPathAndSearch(value: string) {
  const withoutHash = stripHash(value)
  const questionMarkIndex = withoutHash.indexOf('?')

  if (questionMarkIndex === -1) {
    return {
      pathname: withoutHash,
      search: '',
    }
  }

  return {
    pathname: withoutHash.slice(0, questionMarkIndex),
    search: withoutHash.slice(questionMarkIndex),
  }
}

export function normalizePath(pathname: string) {
  const { pathname: rawPath } = splitPathAndSearch(pathname)
  const prefixed = rawPath.startsWith('/') ? rawPath : `/${rawPath}`
  const trimmed = prefixed.replace(/\/+$/u, '')
  return trimmed === '' ? '/' : trimmed
}

export function normalizeSearch(search: string) {
  if (!search || search === '?') {
    return ''
  }

  return search.startsWith('?') ? search : `?${search}`
}

export function normalizeHref(value: string) {
  const { pathname, search } = splitPathAndSearch(value)
  return `${normalizePath(pathname)}${normalizeSearch(search)}`
}

function splitPath(pathname: string) {
  const normalized = normalizePath(pathname)
  return normalized === '/' ? [] : normalized.slice(1).split('/').filter(Boolean)
}

export function matchPathPattern(pattern: string, pathname: string) {
  const patternSegments = splitPath(pattern)
  const pathnameSegments = splitPath(pathname)
  const params: Record<string, string> = {}

  if (patternSegments.length === 0 && pathnameSegments.length === 0) {
    return { matched: true, params, score: 1000 }
  }

  let score = 0

  for (let index = 0; index < patternSegments.length; index += 1) {
    const patternSegment = patternSegments[index]
    const pathnameSegment = pathnameSegments[index]

    if (patternSegment === '$') {
      score += 1
      return { matched: true, params, score }
    }

    if (pathnameSegment === undefined) {
      return { matched: false, params: {}, score: 0 }
    }

    if (patternSegment.startsWith('$')) {
      params[patternSegment.slice(1)] = decodeURIComponent(pathnameSegment)
      score += 5
      continue
    }

    if (patternSegment !== pathnameSegment) {
      return { matched: false, params: {}, score: 0 }
    }

    score += 10
  }

  if (patternSegments.length !== pathnameSegments.length) {
    return { matched: false, params: {}, score: 0 }
  }

  return { matched: true, params, score }
}

export function buildRouteBranch(manifest: readonly GeneratedRouteRecord[], leafId: string) {
  const routesById = new Map(manifest.map((entry) => [entry.id, entry] as const))
  const branch: GeneratedRouteRecord[] = []

  let current = routesById.get(leafId)

  while (current) {
    branch.unshift(current)
    current = current.parentId ? routesById.get(current.parentId) : undefined
  }

  return branch
}