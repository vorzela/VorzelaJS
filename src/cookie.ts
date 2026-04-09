import { createHmac, timingSafeEqual } from 'node:crypto'

export type CookiePolicy = 'cross-site' | 'host' | 'partitioned'

export interface CookieOptions {
  domain?: string
  expires?: Date
  httpOnly?: boolean
  maxAge?: number
  partitioned?: boolean
  path?: string
  policy?: CookiePolicy
  priority?: 'high' | 'low' | 'medium'
  sameSite?: 'lax' | 'none' | 'strict'
  secrets?: string[]
  secure?: boolean
}

export interface CookieHeaderTarget {
  headers: Headers
}

export interface VorzelaCookie {
  name: string
  options: Required<Pick<CookieOptions, 'httpOnly' | 'path' | 'sameSite' | 'secure'>> & CookieOptions
  destroy: () => Promise<string>
  parse: (cookieHeader: string | null) => Promise<string | null>
  serialize: (value: string) => Promise<string>
}

export const cookiePolicies = {
  crossSite(options: CookieOptions = {}): CookieOptions {
    return {
      ...options,
      policy: 'cross-site',
    }
  },

  host(options: CookieOptions = {}): CookieOptions {
    return {
      ...options,
      policy: 'host',
    }
  },

  partitioned(options: CookieOptions = {}): CookieOptions {
    return {
      ...options,
      policy: 'partitioned',
    }
  },
}

function sign(value: string, secret: string): string {
  const signature = createHmac('sha256', secret).update(value).digest('base64url')
  return `${value}.${signature}`
}

function unsign(signed: string, secrets: string[]): string | null {
  const lastDot = signed.lastIndexOf('.')

  if (lastDot === -1) {
    return null
  }

  const value = signed.slice(0, lastDot)
  const providedSignature = signed.slice(lastDot + 1)

  for (const secret of secrets) {
    const expectedSignature = createHmac('sha256', secret).update(value).digest('base64url')

    try {
      const providedBuffer = Buffer.from(providedSignature, 'base64url')
      const expectedBuffer = Buffer.from(expectedSignature, 'base64url')

      if (
        providedBuffer.length === expectedBuffer.length
        && timingSafeEqual(providedBuffer, expectedBuffer)
      ) {
        return value
      }
    } catch {
      continue
    }
  }

  return null
}

function startsWithCookiePrefix(name: string, prefix: string) {
  return name.startsWith(prefix)
}

function normalizeDomain(domain: string | undefined) {
  if (!domain) {
    return undefined
  }

  return domain.trim().replace(/^\.+/u, '') || undefined
}

function resolveCookieOptions(name: string, options: CookieOptions): Required<Pick<CookieOptions, 'httpOnly' | 'path' | 'sameSite' | 'secure'>> & CookieOptions {
  const resolvedOptions: Required<Pick<CookieOptions, 'httpOnly' | 'path' | 'sameSite' | 'secure'>> & CookieOptions = {
    ...options,
    domain: normalizeDomain(options.domain),
    httpOnly: options.httpOnly ?? true,
    path: options.path ?? '/',
    sameSite: options.sameSite ?? 'lax',
    secure: options.secure ?? (process.env.NODE_ENV === 'production'),
  }

  if (resolvedOptions.policy === 'cross-site') {
    resolvedOptions.sameSite = 'none'
    resolvedOptions.secure = true
  }

  if (resolvedOptions.policy === 'partitioned') {
    resolvedOptions.partitioned = true
    resolvedOptions.sameSite = 'none'
    resolvedOptions.secure = true
  }

  if (resolvedOptions.partitioned) {
    resolvedOptions.sameSite = resolvedOptions.sameSite ?? 'none'
    resolvedOptions.secure = true
  }

  if (resolvedOptions.sameSite === 'none') {
    resolvedOptions.secure = true
  }

  if (
    startsWithCookiePrefix(name, '__Secure-')
    || startsWithCookiePrefix(name, '__Host-')
    || startsWithCookiePrefix(name, '__Http-')
    || startsWithCookiePrefix(name, '__Host-Http-')
  ) {
    resolvedOptions.secure = true
  }

  if (startsWithCookiePrefix(name, '__Http-') || startsWithCookiePrefix(name, '__Host-Http-')) {
    resolvedOptions.httpOnly = true
  }

  if (startsWithCookiePrefix(name, '__Host-') || startsWithCookiePrefix(name, '__Host-Http-')) {
    resolvedOptions.path = '/'

    if (resolvedOptions.domain) {
      throw new Error(`Cookie '${name}' cannot set Domain when using a __Host- or __Host-Http- prefix`)
    }
  }

  return resolvedOptions
}

function encodeCookieValue(name: string, value: string, options: CookieOptions): string {
  const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`]

  if (options.domain) {
    parts.push(`Domain=${options.domain}`)
  }

  if (options.httpOnly) {
    parts.push('HttpOnly')
  }

  if (options.expires) {
    parts.push(`Expires=${options.expires.toUTCString()}`)
  }

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${options.maxAge}`)
  }

  if (options.partitioned) {
    parts.push('Partitioned')
  }

  if (options.path) {
    parts.push(`Path=${options.path}`)
  }

  if (options.priority) {
    parts.push(`Priority=${options.priority.charAt(0).toUpperCase()}${options.priority.slice(1)}`)
  }

  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite.charAt(0).toUpperCase()}${options.sameSite.slice(1)}`)
  }

  if (options.secure) {
    parts.push('Secure')
  }

  return parts.join('; ')
}

function parseCookieHeader(header: string): Map<string, string> {
  const cookies = new Map<string, string>()

  for (const pair of header.split(';')) {
    const equalIndex = pair.indexOf('=')

    if (equalIndex === -1) {
      continue
    }

    const name = pair.slice(0, equalIndex).trim()
    const value = pair.slice(equalIndex + 1).trim()

    try {
      cookies.set(decodeURIComponent(name), decodeURIComponent(value))
    } catch {
      cookies.set(name, value)
    }
  }

  return cookies
}

function resolveHeaders(target: CookieHeaderTarget | Headers) {
  return target instanceof Headers ? target : target.headers
}

function createDestroyCookie(cookie: VorzelaCookie) {
  return createCookie(cookie.name, {
    ...cookie.options,
    expires: new Date(0),
    maxAge: 0,
  })
}

export async function setCookie(target: CookieHeaderTarget | Headers, cookie: VorzelaCookie, value: string) {
  const serialized = await cookie.serialize(value)
  resolveHeaders(target).append('Set-Cookie', serialized)
  return serialized
}

export async function deleteCookie(target: CookieHeaderTarget | Headers, cookie: VorzelaCookie) {
  const serialized = await cookie.destroy()
  resolveHeaders(target).append('Set-Cookie', serialized)
  return serialized
}

export function createCookie(name: string, options: CookieOptions = {}): VorzelaCookie {
  const resolvedOptions = resolveCookieOptions(name, options)

  return {
    name,
    options: resolvedOptions,

    async destroy(): Promise<string> {
      return createDestroyCookie(this).serialize('')
    },

    async parse(cookieHeader: string | null): Promise<string | null> {
      if (!cookieHeader) {
        return null
      }

      const cookies = parseCookieHeader(cookieHeader)
      const raw = cookies.get(name)

      if (raw === undefined) {
        return null
      }

      if (resolvedOptions.secrets?.length) {
        return unsign(raw, resolvedOptions.secrets)
      }

      return raw
    },

    async serialize(value: string): Promise<string> {
      const signedValue = resolvedOptions.secrets?.length
        ? sign(value, resolvedOptions.secrets[0])
        : value

      return encodeCookieValue(name, signedValue, resolvedOptions)
    },
  }
}
