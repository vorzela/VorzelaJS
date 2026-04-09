import { normalizeHref, normalizePath, normalizeSearch } from './path'
import type {
  NavigateToOptions,
  RouteSearch,
  RouteSearchInput,
  RouteSearchPrimitive,
  RouteSearchUpdater,
  RouteSearchValue,
} from './types'

const SEARCH_BASE_URL = 'http://vorzelajs.local'

function coerceSearchEntry(value: Exclude<RouteSearchPrimitive, null | undefined>) {
  return String(value)
}

function getFirstSearchValue(value: unknown) {
  if (Array.isArray(value)) {
    return value[0]
  }

  return value
}

function toSearchArray(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => typeof entry === 'string' ? entry.trim() : String(entry ?? '').trim())
      .filter(Boolean)
  }

  if (value === null || value === undefined) {
    return []
  }

  const singleValue = typeof value === 'string' ? value.trim() : String(value).trim()
  return singleValue ? [singleValue] : []
}

export function readSearchParams(searchParams: URLSearchParams): RouteSearch {
  const rawSearch: RouteSearch = {}

  for (const key of new Set(searchParams.keys())) {
    const values = searchParams.getAll(key)
    rawSearch[key] = values.length <= 1 ? values[0] : values
  }

  return rawSearch
}

export function parseSearchString(search: string) {
  return readSearchParams(new URLSearchParams(normalizeSearch(search)))
}

export function stringifySearchInput(search: RouteSearchInput) {
  const searchParams = new URLSearchParams()

  for (const [key, rawValue] of Object.entries(search)) {
    if (rawValue === undefined || rawValue === null) {
      continue
    }

    if (Array.isArray(rawValue)) {
      const values = rawValue
        .filter((value): value is Exclude<RouteSearchPrimitive, null | undefined> => value !== undefined && value !== null)
        .map(coerceSearchEntry)

      for (const value of values) {
        searchParams.append(key, value)
      }

      continue
    }

    searchParams.set(key, coerceSearchEntry(rawValue))
  }

  const serialized = searchParams.toString()
  return serialized ? `?${serialized}` : ''
}

export function resolveSearchUpdater<CurrentSearch extends RouteSearch = RouteSearch>(
  currentSearch: CurrentSearch,
  updater: RouteSearchUpdater<CurrentSearch>,
) {
  return typeof updater === 'function'
    ? updater(currentSearch)
    : updater
}

export function mergeSearchInput(currentSearch: RouteSearch, patch: RouteSearchInput) {
  const nextSearch: RouteSearchInput = {}

  for (const [key, value] of Object.entries(currentSearch)) {
    nextSearch[key] = value as RouteSearchValue
  }

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === null) {
      delete nextSearch[key]
      continue
    }

    if (Array.isArray(value) && value.filter((entry) => entry !== undefined && entry !== null).length === 0) {
      delete nextSearch[key]
      continue
    }

    nextSearch[key] = value
  }

  return nextSearch
}

export function resolveMergedSearch<CurrentSearch extends RouteSearch = RouteSearch>(
  currentSearch: RouteSearch,
  typedCurrentSearch: CurrentSearch,
  updater: RouteSearchUpdater<CurrentSearch>,
) {
  const patch = resolveSearchUpdater(typedCurrentSearch, updater)
  return mergeSearchInput(currentSearch, patch)
}

export function resolveNavigateHref<CurrentSearch extends RouteSearch = RouteSearch>(
  currentHref: string,
  target: string | NavigateToOptions<CurrentSearch>,
  currentSearchForUpdater?: CurrentSearch,
) {
  if (typeof target === 'string') {
    return normalizeHref(target)
  }

  const baseHref = normalizeHref(target.to ?? currentHref)

  if (!target.search) {
    return baseHref
  }

  const url = new URL(baseHref, SEARCH_BASE_URL)
  const nextSearch = resolveSearchUpdater(
    currentSearchForUpdater ?? readSearchParams(url.searchParams) as CurrentSearch,
    target.search,
  )

  return `${normalizePath(url.pathname)}${stringifySearchInput(nextSearch)}`
}

export const filterSearch = {
  array(values: readonly RouteSearchPrimitive[] | null | undefined) {
    const normalized = (values ?? [])
      .filter((value): value is Exclude<RouteSearchPrimitive, null | undefined> => value !== undefined && value !== null)
      .map((value) => String(value).trim())
      .filter(Boolean)

    return normalized.length > 0 ? normalized : undefined
  },

  boolean(value: boolean | null | undefined, options: { keepFalse?: boolean } = {}) {
    if (value === undefined || value === null) {
      return undefined
    }

    if (value === false && !options.keepFalse) {
      return undefined
    }

    return value
  },

  page(value: number | string | null | undefined, defaultPage = 1) {
    const parsed = typeof value === 'number'
      ? Math.trunc(value)
      : Number.parseInt(String(value ?? ''), 10)

    if (!Number.isFinite(parsed) || parsed < 1 || parsed === defaultPage) {
      return undefined
    }

    return parsed
  },

  readArray(search: RouteSearch, key: string) {
    return toSearchArray(search[key])
  },

  readBoolean(search: RouteSearch, key: string, fallback = false) {
    const value = getFirstSearchValue(search[key])

    if (typeof value === 'boolean') {
      return value
    }

    if (typeof value === 'number') {
      return value !== 0
    }

    if (typeof value !== 'string') {
      return fallback
    }

    const normalized = value.trim().toLowerCase()

    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
      return true
    }

    if (['0', 'false', 'no', 'off'].includes(normalized)) {
      return false
    }

    return fallback
  },

  readPage(search: RouteSearch, key = 'page', defaultPage = 1) {
    const value = getFirstSearchValue(search[key])
    const parsed = typeof value === 'number'
      ? Math.trunc(value)
      : Number.parseInt(String(value ?? ''), 10)

    if (!Number.isFinite(parsed) || parsed < 1) {
      return defaultPage
    }

    return parsed
  },

  readSort<const Sort extends string>(
    search: RouteSearch,
    key: string,
    allowedValues: readonly Sort[],
    fallback: Sort,
  ) {
    const value = getFirstSearchValue(search[key])

    if (typeof value !== 'string') {
      return fallback
    }

    return allowedValues.includes(value as Sort) ? value as Sort : fallback
  },

  readText(search: RouteSearch, key: string, fallback = '') {
    const value = getFirstSearchValue(search[key])

    if (value === undefined || value === null) {
      return fallback
    }

    const normalized = String(value).trim()
    return normalized === '' ? fallback : normalized
  },

  sort<Sort extends string>(value: Sort | null | undefined, defaultValue?: Sort) {
    if (!value || (defaultValue !== undefined && value === defaultValue)) {
      return undefined
    }

    return value
  },

  text(value: string | null | undefined) {
    const normalized = value?.trim() ?? ''
    return normalized === '' ? undefined : normalized
  },
}