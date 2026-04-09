import { normalizeHref, normalizePath } from './path.js'

const REDIRECT_SIGNAL = Symbol.for('vorzelajs.redirect')
const NOT_FOUND_SIGNAL = Symbol.for('vorzelajs.not-found')

const REDIRECT_TARGET_BASE_URL = 'http://vorzelajs.local'

export interface RedirectOptions {
  replace?: boolean
  status?: 301 | 302 | 303 | 307 | 308
  to: string
}

export interface RedirectTargetOptions {
  defaultTo?: string
  disallowedPrefixes?: string[]
}

export interface RedirectParamOptions {
  paramName?: string
}

export class RedirectSignal extends Error {
  readonly replace: boolean
  readonly status: 301 | 302 | 303 | 307 | 308
  readonly to: string
  readonly [REDIRECT_SIGNAL] = true

  constructor(options: RedirectOptions) {
    super(`Redirect to ${options.to}`)
    this.name = 'RedirectSignal'
    this.replace = options.replace ?? true
    this.status = options.status ?? 302
    this.to = options.to
  }
}

export interface NotFoundOptions {
  message?: string
}

export class NotFoundSignal extends Error {
  readonly [NOT_FOUND_SIGNAL] = true

  constructor(options: NotFoundOptions = {}) {
    super(options.message ?? 'Not Found')
    this.name = 'NotFoundSignal'
  }
}

export function redirect(options: RedirectOptions) {
  return new RedirectSignal(options)
}

export function withRedirectParam(to: string, redirectTo: string, options: RedirectParamOptions = {}) {
  const url = new URL(normalizeHref(to), REDIRECT_TARGET_BASE_URL)
  const paramName = options.paramName ?? 'redirect'

  url.searchParams.set(paramName, resolveRedirectTarget(redirectTo))

  return `${normalizePath(url.pathname)}${url.search}`
}

export function resolveRedirectTarget(target: unknown, options: RedirectTargetOptions = {}) {
  const fallback = normalizeHref(options.defaultTo ?? '/')

  if (typeof target !== 'string' || target.trim() === '' || target.startsWith('//') || !target.startsWith('/')) {
    return fallback
  }

  let url: URL

  try {
    url = new URL(target, REDIRECT_TARGET_BASE_URL)
  } catch {
    return fallback
  }

  if (url.origin !== REDIRECT_TARGET_BASE_URL) {
    return fallback
  }

  const normalizedTarget = normalizeHref(`${url.pathname}${url.search}`)

  for (const prefix of options.disallowedPrefixes ?? []) {
    const normalizedPrefix = normalizePath(prefix)

    if (
      normalizedTarget === normalizedPrefix
      || normalizedTarget.startsWith(`${normalizedPrefix}/`)
      || normalizedTarget.startsWith(`${normalizedPrefix}?`)
    ) {
      return fallback
    }
  }

  return normalizedTarget
}

export function isRedirect(value: unknown): value is RedirectSignal {
  return value instanceof RedirectSignal
    || (typeof value === 'object' && value !== null && REDIRECT_SIGNAL in value)
}

export function notFound(options: NotFoundOptions = {}) {
  return new NotFoundSignal(options)
}

export function isNotFound(value: unknown): value is NotFoundSignal {
  return value instanceof NotFoundSignal
    || (typeof value === 'object' && value !== null && NOT_FOUND_SIGNAL in value)
}