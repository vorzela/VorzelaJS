import type { CookieOptions, VorzelaCookie } from './cookie'
import { createCookie } from './cookie'

export interface SessionData {
  [key: string]: unknown
}

export interface VorzelaSession {
  data: SessionData
  get<T = unknown>(key: string): T | undefined
  has(key: string): boolean
  set(key: string, value: unknown): void
  unset(key: string): void
  flash(key: string, value: unknown): void
}

export interface SessionStorage {
  commitSession(session: VorzelaSession): Promise<string>
  destroySession(session: VorzelaSession): Promise<string>
  getSession(cookieHeader: string | null): Promise<VorzelaSession>
}

const FLASH_PREFIX = '__flash_'

function createSession(data: SessionData = {}): VorzelaSession {
  const sessionData = { ...data }

  return {
    get data() {
      return { ...sessionData }
    },

    get<T = unknown>(key: string): T | undefined {
      const flashKey = `${FLASH_PREFIX}${key}`

      if (flashKey in sessionData) {
        const value = sessionData[flashKey]
        delete sessionData[flashKey]
        return value as T
      }

      return sessionData[key] as T | undefined
    },

    has(key: string): boolean {
      return key in sessionData || `${FLASH_PREFIX}${key}` in sessionData
    },

    set(key: string, value: unknown): void {
      sessionData[key] = value
    },

    unset(key: string): void {
      delete sessionData[key]
    },

    flash(key: string, value: unknown): void {
      sessionData[`${FLASH_PREFIX}${key}`] = value
    },
  }
}

export function createCookieSessionStorage(options: {
  cookie?: VorzelaCookie | (CookieOptions & { name?: string })
} = {}): SessionStorage {
  const cookie = options.cookie && 'parse' in options.cookie
    ? options.cookie
    : createCookie(
        (options.cookie as CookieOptions & { name?: string })?.name ?? '__session',
        options.cookie as CookieOptions ?? {},
      )

  return {
    async getSession(cookieHeader: string | null): Promise<VorzelaSession> {
      const raw = await cookie.parse(cookieHeader)

      if (!raw) {
        return createSession()
      }

      try {
        const data = JSON.parse(raw) as SessionData
        return createSession(data)
      } catch {
        return createSession()
      }
    },

    async commitSession(session: VorzelaSession): Promise<string> {
      const serialized = JSON.stringify(session.data)
      return cookie.serialize(serialized)
    },

    async destroySession(_session: VorzelaSession): Promise<string> {
      return cookie.destroy()
    },
  }
}
