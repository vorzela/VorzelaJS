import type { CookieOptions } from './cookie'
import { cookiePolicies, createCookie, setCookie } from './cookie'

type MaybePromise<T> = T | Promise<T>

const DEFAULT_VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 90
const INTERNAL_NAVIGATION_EVENT = 'vorzelajs:analytics:navigation'

const CLICK_ID_PLATFORMS: Record<string, string> = {
  dclid: 'google',
  epik: 'pinterest',
  fbclid: 'facebook',
  gbraid: 'google',
  gclid: 'google',
  li_fat_id: 'linkedin',
  msclkid: 'microsoft',
  ttclid: 'tiktok',
  twclid: 'x',
  wbraid: 'google',
}

const PLATFORM_HOST_PATTERNS: Array<{ host: string; platform: string }> = [
  { host: 'google.', platform: 'google' },
  { host: 'googleadservices.com', platform: 'google' },
  { host: 'bing.com', platform: 'microsoft' },
  { host: 'msn.com', platform: 'microsoft' },
  { host: 'duckduckgo.com', platform: 'duckduckgo' },
  { host: 'search.yahoo.com', platform: 'yahoo' },
  { host: 'facebook.com', platform: 'facebook' },
  { host: 'fb.com', platform: 'facebook' },
  { host: 'instagram.com', platform: 'instagram' },
  { host: 'linkedin.com', platform: 'linkedin' },
  { host: 'lnkd.in', platform: 'linkedin' },
  { host: 'tiktok.com', platform: 'tiktok' },
  { host: 'twitter.com', platform: 'x' },
  { host: 'x.com', platform: 'x' },
  { host: 't.co', platform: 'x' },
  { host: 'reddit.com', platform: 'reddit' },
  { host: 'redd.it', platform: 'reddit' },
  { host: 'youtube.com', platform: 'youtube' },
  { host: 'youtu.be', platform: 'youtube' },
  { host: 'pinterest.com', platform: 'pinterest' },
  { host: 'pin.it', platform: 'pinterest' },
  { host: 'whatsapp.com', platform: 'whatsapp' },
]

const PLATFORM_SOURCE_ALIASES: Record<string, string> = {
  'adwords': 'google',
  'bing': 'microsoft',
  'facebook': 'facebook',
  'fb': 'facebook',
  'google': 'google',
  'google-ads': 'google',
  'googleads': 'google',
  'ig': 'instagram',
  'instagram': 'instagram',
  'linkedin': 'linkedin',
  'meta': 'facebook',
  'msn': 'microsoft',
  'newsletter': 'email',
  'pinterest': 'pinterest',
  'reddit': 'reddit',
  'tiktok': 'tiktok',
  'twitter': 'x',
  'x': 'x',
  'youtube': 'youtube',
}

const EMAIL_MEDIA = new Set(['drip', 'email', 'email-marketing', 'newsletter'])
const PAID_MEDIA = new Set(['affiliate', 'cpa', 'cpc', 'cpp', 'cpm', 'display', 'paid', 'paid-social', 'paid_social', 'paidsocial', 'ppc', 'retargeting'])
const SEARCH_MEDIA = new Set(['organic', 'search', 'seo'])
const SOCIAL_MEDIA = new Set(['organic-social', 'social', 'social-media', 'social_media'])
const SEARCH_PLATFORMS = new Set(['duckduckgo', 'google', 'microsoft', 'yahoo'])
const SOCIAL_PLATFORMS = new Set(['facebook', 'instagram', 'linkedin', 'pinterest', 'reddit', 'tiktok', 'whatsapp', 'x', 'youtube'])

export const DEFAULT_ANALYTICS_ENDPOINT = '/__vorzela/analytics'

export type AnalyticsEventType = 'event' | 'pageview'
export type AnalyticsTrafficChannel =
  | 'direct'
  | 'email'
  | 'internal'
  | 'organic-search'
  | 'organic-social'
  | 'paid-search'
  | 'paid-social'
  | 'referral'
  | 'unknown'

export interface AnalyticsTouchPoint {
  campaign: string | null
  capturedAt: string
  channel: AnalyticsTrafficChannel
  clickIds: Record<string, string>
  content: string | null
  entryUrl: string
  isPaid: boolean
  medium: string | null
  platform: string | null
  referrer: string | null
  referrerHost: string | null
  source: string | null
  term: string | null
}

export interface AnalyticsClientContext {
  language?: string | null
  screen?: {
    height: number
    width: number
  } | null
  sessionId?: string | null
  timezone?: string | null
  visitorId?: string | null
}

export interface AnalyticsClientPayload {
  context?: AnalyticsClientContext
  firstTouch?: AnalyticsTouchPoint | null
  lastTouch?: AnalyticsTouchPoint | null
  name?: string
  pathname?: string
  properties?: Record<string, unknown>
  referrer?: string | null
  search?: string
  timestamp?: string
  title?: string | null
  type?: AnalyticsEventType
  url?: string
}

export interface AnalyticsUserAgentSummary {
  browser: string | null
  browserVersion: string | null
  deviceType: 'bot' | 'desktop' | 'mobile' | 'tablet' | 'unknown'
  isBot: boolean
  os: string | null
  platformHint: string | null
  raw: string | null
}

export interface AnalyticsGeoSummary {
  city: string | null
  country: string | null
  region: string | null
}

export interface AnalyticsEvent {
  attribution: AnalyticsTouchPoint
  client: {
    language: string | null
    screen: AnalyticsClientContext['screen']
    timezone: string | null
  }
  firstTouch: AnalyticsTouchPoint | null
  id: string
  lastTouch: AnalyticsTouchPoint | null
  name: string
  occurredAt: string
  page: {
    pathname: string | null
    referrer: string | null
    search: string
    title: string | null
    url: string | null
  }
  properties: Record<string, unknown>
  receivedAt: string
  request: {
    host: string | null
    origin: string | null
    referer: string | null
    secFetchSite: string | null
  }
  sessionId: string | null
  type: AnalyticsEventType
  userAgent: AnalyticsUserAgentSummary
  visitorId: string
  geo: AnalyticsGeoSummary | null
}

export interface AnalyticsDefinition {
  allowedOrigins?: string[] | ((origin: string | null, request: Request) => boolean)
  onEvent?: (event: AnalyticsEvent, context: { payload: AnalyticsClientPayload; request: Request }) => MaybePromise<void>
  visitorCookie?: false | {
    name?: string
    options?: CookieOptions
  }
}

export interface AnalyticsClientOptions {
  credentials?: RequestCredentials
  endpoint?: string
  firstTouchKey?: string
  includeLanguage?: boolean
  includeScreen?: boolean
  includeTimezone?: boolean
  lastTouchKey?: string
  sessionKey?: string
  storageKey?: string
  transport?: 'auto' | 'beacon' | 'fetch'
}

export interface AnalyticsClient {
  event: (name: string, properties?: Record<string, unknown>, payload?: Omit<AnalyticsClientPayload, 'name' | 'properties' | 'type'>) => Promise<boolean>
  pageview: (payload?: Omit<AnalyticsClientPayload, 'name' | 'type'>) => Promise<boolean>
  startAutoPageviews: (options?: { trackInitialPageview?: boolean }) => () => void
  track: (payload: AnalyticsClientPayload) => Promise<boolean>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toPlainRecord(value: unknown) {
  return isRecord(value) ? value : {}
}

function trimToNull(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function normalizeMedium(value: string | null) {
  return value?.toLowerCase().replace(/[_\s]+/gu, '-') ?? null
}

function matchesHostPattern(host: string, pattern: string) {
  return host === pattern || host.endsWith(`.${pattern}`) || host.includes(pattern)
}

function normalizePlatform(value: string | null) {
  if (!value) {
    return null
  }

  const normalized = value.trim().toLowerCase().replace(/[_\s]+/gu, '-')
  return PLATFORM_SOURCE_ALIASES[normalized] ?? normalized
}

function detectPlatformFromHost(host: string | null) {
  if (!host) {
    return null
  }

  const normalizedHost = host.toLowerCase()

  for (const candidate of PLATFORM_HOST_PATTERNS) {
    if (matchesHostPattern(normalizedHost, candidate.host)) {
      return candidate.platform
    }
  }

  return null
}

function toUrl(value: string | URL | null | undefined, base?: string) {
  if (!value) {
    return null
  }

  try {
    return value instanceof URL
      ? value
      : new URL(value, base)
  } catch {
    return null
  }
}

function randomId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `vrz_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

function readClickIds(searchParams: URLSearchParams) {
  const clickIds: Record<string, string> = {}

  for (const [key, platform] of Object.entries(CLICK_ID_PLATFORMS)) {
    const value = trimToNull(searchParams.get(key))

    if (value) {
      clickIds[key] = value

      if (!clickIds.platform) {
        clickIds.platform = platform
      }
    }
  }

  return clickIds
}

function isSameHost(left: string | null, right: string | null) {
  return Boolean(left && right && left.toLowerCase() === right.toLowerCase())
}

function getTrafficChannel(input: {
  isPaid: boolean
  landingHost: string | null
  medium: string | null
  platform: string | null
  referrerHost: string | null
  source: string | null
}) {
  if (!input.source && !input.medium && !input.referrerHost) {
    return 'direct' satisfies AnalyticsTrafficChannel
  }

  if (isSameHost(input.landingHost, input.referrerHost)) {
    return 'internal' satisfies AnalyticsTrafficChannel
  }

  if (input.medium && EMAIL_MEDIA.has(input.medium)) {
    return 'email' satisfies AnalyticsTrafficChannel
  }

  if (input.isPaid && (input.medium === 'search' || (input.platform && SEARCH_PLATFORMS.has(input.platform)))) {
    return 'paid-search' satisfies AnalyticsTrafficChannel
  }

  if (input.isPaid && (input.medium === 'social' || input.medium === 'organic-social' || (input.platform && SOCIAL_PLATFORMS.has(input.platform)))) {
    return 'paid-social' satisfies AnalyticsTrafficChannel
  }

  if (!input.isPaid && (input.medium ? SEARCH_MEDIA.has(input.medium) : false || (input.platform && SEARCH_PLATFORMS.has(input.platform)))) {
    return 'organic-search' satisfies AnalyticsTrafficChannel
  }

  if (!input.isPaid && (input.medium ? SOCIAL_MEDIA.has(input.medium) : false || (input.platform && SOCIAL_PLATFORMS.has(input.platform)))) {
    return 'organic-social' satisfies AnalyticsTrafficChannel
  }

  if (input.referrerHost) {
    return 'referral' satisfies AnalyticsTrafficChannel
  }

  return 'unknown' satisfies AnalyticsTrafficChannel
}

export function classifyAnalyticsTraffic(input: {
  landingUrl?: string | URL | null
  referrer?: string | null
}): AnalyticsTouchPoint {
  const landingUrl = toUrl(input.landingUrl ?? null, 'http://localhost')
  const referrerUrl = toUrl(input.referrer ?? null)
  const landingHost = landingUrl?.host ?? null
  const referrerHost = referrerUrl?.host ?? null
  const source = trimToNull(landingUrl?.searchParams.get('utm_source') ?? null)
  const medium = trimToNull(landingUrl?.searchParams.get('utm_medium') ?? null)
  const campaign = trimToNull(landingUrl?.searchParams.get('utm_campaign') ?? null)
  const term = trimToNull(landingUrl?.searchParams.get('utm_term') ?? null)
  const content = trimToNull(landingUrl?.searchParams.get('utm_content') ?? null)
  const clickIds = landingUrl ? readClickIds(landingUrl.searchParams) : {}
  const mediumKey = normalizeMedium(medium)
  const clickPlatform = normalizePlatform(clickIds.platform ?? null)
  const sourcePlatform = normalizePlatform(source)
  const referrerPlatform = detectPlatformFromHost(referrerHost)
  const platform = clickPlatform ?? sourcePlatform ?? referrerPlatform
  const isPaid = Object.keys(clickIds).some((key) => key !== 'platform') || (mediumKey ? PAID_MEDIA.has(mediumKey) : false)
  const channel = getTrafficChannel({
    isPaid,
    landingHost,
    medium: mediumKey,
    platform,
    referrerHost,
    source,
  })

  return {
    campaign,
    capturedAt: new Date().toISOString(),
    channel,
    clickIds: Object.fromEntries(Object.entries(clickIds).filter(([key]) => key !== 'platform')),
    content,
    entryUrl: landingUrl?.toString() ?? '/',
    isPaid,
    medium,
    platform,
    referrer: referrerUrl?.toString() ?? trimToNull(input.referrer) ?? null,
    referrerHost,
    source: source ?? referrerPlatform,
    term,
  }
}

export function extractAnalyticsTouchPoint(landingUrl: string | URL, referrer?: string | null) {
  return classifyAnalyticsTraffic({
    landingUrl,
    referrer,
  })
}

function parseUserAgent(userAgent: string | null, platformHint: string | null): AnalyticsUserAgentSummary {
  const raw = userAgent ?? null
  const normalized = raw?.toLowerCase() ?? ''
  const normalizedPlatformHint = trimToNull(platformHint?.replace(/^"|"$/gu, '') ?? null)
  const isBot = /bot|crawler|spider|curl|postman|headless/iu.test(normalized)

  let browser: string | null = null
  let browserVersion: string | null = null

  const browserMatchers: Array<{ browser: string; regex: RegExp }> = [
    { browser: 'edge', regex: /edg(?:a|ios)?\/(\d+(?:\.\d+)*)/iu },
    { browser: 'opera', regex: /opr\/(\d+(?:\.\d+)*)/iu },
    { browser: 'firefox', regex: /firefox\/(\d+(?:\.\d+)*)/iu },
    { browser: 'chrome', regex: /(?:chrome|crios)\/(\d+(?:\.\d+)*)/iu },
    { browser: 'safari', regex: /version\/(\d+(?:\.\d+)*)[\s\S]*safari/iu },
  ]

  for (const matcher of browserMatchers) {
    const result = raw?.match(matcher.regex)

    if (result) {
      browser = matcher.browser
      browserVersion = result[1] ?? null
      break
    }
  }

  let os: string | null = normalizedPlatformHint?.toLowerCase() ?? null

  if (!os) {
    if (normalized.includes('android')) {
      os = 'android'
    } else if (normalized.includes('iphone') || normalized.includes('ipad') || normalized.includes('ios')) {
      os = 'ios'
    } else if (normalized.includes('mac os x') || normalized.includes('macintosh')) {
      os = 'macos'
    } else if (normalized.includes('windows')) {
      os = 'windows'
    } else if (normalized.includes('linux')) {
      os = 'linux'
    }
  }

  let deviceType: AnalyticsUserAgentSummary['deviceType'] = 'unknown'

  if (isBot) {
    deviceType = 'bot'
  } else if (normalized.includes('ipad') || normalized.includes('tablet')) {
    deviceType = 'tablet'
  } else if (normalized.includes('mobile') || normalized.includes('iphone') || normalized.includes('android')) {
    deviceType = 'mobile'
  } else if (os) {
    deviceType = 'desktop'
  }

  return {
    browser,
    browserVersion,
    deviceType,
    isBot,
    os,
    platformHint: normalizedPlatformHint,
    raw,
  }
}

function extractGeoSummary(request: Request): AnalyticsGeoSummary | null {
  const headers = request.headers
  const geo = {
    city: trimToNull(headers.get('x-vercel-ip-city') ?? headers.get('x-city')),
    country: trimToNull(
      headers.get('cf-ipcountry')
      ?? headers.get('cloudfront-viewer-country')
      ?? headers.get('x-vercel-ip-country')
      ?? headers.get('x-country-code'),
    ),
    region: trimToNull(headers.get('x-vercel-ip-country-region') ?? headers.get('x-region')),
  }

  return geo.city || geo.country || geo.region ? geo : null
}

function getStorage(storageKind: 'localStorage' | 'sessionStorage') {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window[storageKind]
  } catch {
    return null
  }
}

function readStoredTouchPoint(storage: Storage | null, key: string) {
  if (!storage) {
    return null
  }

  try {
    const raw = storage.getItem(key)

    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as unknown
    return isRecord(parsed) ? parsed as unknown as AnalyticsTouchPoint : null
  } catch {
    return null
  }
}

function writeStoredTouchPoint(storage: Storage | null, key: string, value: AnalyticsTouchPoint) {
  if (!storage) {
    return
  }

  try {
    storage.setItem(key, JSON.stringify(value))
  } catch {
    return
  }
}

function readStoredValue(storage: Storage | null, key: string) {
  if (!storage) {
    return null
  }

  try {
    return trimToNull(storage.getItem(key))
  } catch {
    return null
  }
}

function writeStoredValue(storage: Storage | null, key: string, value: string) {
  if (!storage) {
    return
  }

  try {
    storage.setItem(key, value)
  } catch {
    return
  }
}

function ensureStoredId(storage: Storage | null, key: string) {
  const existing = readStoredValue(storage, key)

  if (existing) {
    return existing
  }

  const nextValue = randomId()
  writeStoredValue(storage, key, nextValue)
  return nextValue
}

function createClientContext(options: AnalyticsClientOptions): AnalyticsClientContext {
  if (typeof window === 'undefined') {
    return {}
  }

  const localStorage = getStorage('localStorage')
  const sessionStorage = getStorage('sessionStorage')
  const storageKey = options.storageKey ?? 'vorzelajs:analytics:visitor-id'
  const sessionKey = options.sessionKey ?? 'vorzelajs:analytics:session-id'

  return {
    language: options.includeLanguage === false ? null : navigator.language ?? null,
    screen: options.includeScreen === false
      ? null
      : {
          height: window.screen.height,
          width: window.screen.width,
        },
    sessionId: ensureStoredId(sessionStorage, sessionKey),
    timezone: options.includeTimezone === false
      ? null
      : Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
    visitorId: ensureStoredId(localStorage, storageKey),
  }
}

function ensureTouchPoints(options: AnalyticsClientOptions) {
  if (typeof window === 'undefined') {
    return {
      firstTouch: null,
      lastTouch: null,
    }
  }

  const storage = getStorage('localStorage')
  const firstTouchKey = options.firstTouchKey ?? 'vorzelajs:analytics:first-touch'
  const lastTouchKey = options.lastTouchKey ?? 'vorzelajs:analytics:last-touch'
  const currentTouch = extractAnalyticsTouchPoint(window.location.href, document.referrer || null)
  const storedFirstTouch = readStoredTouchPoint(storage, firstTouchKey)
  const storedLastTouch = readStoredTouchPoint(storage, lastTouchKey)

  if (!storedFirstTouch) {
    writeStoredTouchPoint(storage, firstTouchKey, currentTouch)
  }

  const shouldUpdateLastTouch = currentTouch.channel !== 'internal'
    && (currentTouch.channel !== 'direct' || !storedLastTouch)

  if (shouldUpdateLastTouch) {
    writeStoredTouchPoint(storage, lastTouchKey, currentTouch)
  }

  return {
    firstTouch: readStoredTouchPoint(storage, firstTouchKey) ?? currentTouch,
    lastTouch: readStoredTouchPoint(storage, lastTouchKey) ?? currentTouch,
  }
}

function resolveRequestAllowed(origin: string | null, request: Request, allowedOrigins: AnalyticsDefinition['allowedOrigins']) {
  if (!allowedOrigins) {
    return true
  }

  if (typeof allowedOrigins === 'function') {
    return allowedOrigins(origin, request)
  }

  if (!origin) {
    return false
  }

  return allowedOrigins.includes(origin)
}

function withCorsHeaders(headers: Headers, origin: string | null, request: Request, analytics: AnalyticsDefinition) {
  if (!resolveRequestAllowed(origin, request, analytics.allowedOrigins)) {
    return false
  }

  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin)
    headers.set('Access-Control-Allow-Credentials', 'true')
    headers.set('Access-Control-Allow-Headers', 'Content-Type')
    headers.set('Access-Control-Allow-Methods', 'OPTIONS, POST')
    headers.append('Vary', 'Origin')
  }

  return true
}

function buildEventPage(payload: AnalyticsClientPayload, request: Request) {
  const requestUrl = new URL(request.url)
  const pageUrl = toUrl(
    payload.url ?? request.headers.get('Referer') ?? null,
    `${requestUrl.protocol}//${requestUrl.host}`,
  )

  return {
    pathname: trimToNull(payload.pathname) ?? pageUrl?.pathname ?? null,
    referrer: trimToNull(payload.referrer) ?? null,
    search: trimToNull(payload.search) ?? pageUrl?.search ?? '',
    title: trimToNull(payload.title) ?? null,
    url: pageUrl?.toString() ?? trimToNull(payload.url) ?? null,
  }
}

function getVisitorCookie(analytics: AnalyticsDefinition) {
  if (analytics.visitorCookie === false) {
    return null
  }

  return createCookie(
    analytics.visitorCookie?.name ?? '__Host-vrz_aid',
    {
      ...cookiePolicies.host({
        maxAge: DEFAULT_VISITOR_COOKIE_MAX_AGE,
      }),
      ...analytics.visitorCookie?.options,
    },
  )
}

function buildAnalyticsEvent(payload: AnalyticsClientPayload, request: Request, visitorId: string): AnalyticsEvent {
  const page = buildEventPage(payload, request)
  const attribution = classifyAnalyticsTraffic({
    landingUrl: page.url,
    referrer: page.referrer,
  })

  return {
    attribution,
    client: {
      language: trimToNull(payload.context?.language ?? null),
      screen: payload.context?.screen ?? null,
      timezone: trimToNull(payload.context?.timezone ?? null),
    },
    firstTouch: payload.firstTouch ?? null,
    geo: extractGeoSummary(request),
    id: randomId(),
    lastTouch: payload.lastTouch ?? null,
    name: trimToNull(payload.name) ?? (payload.type === 'pageview' ? 'pageview' : 'event'),
    occurredAt: trimToNull(payload.timestamp) ?? new Date().toISOString(),
    page,
    properties: toPlainRecord(payload.properties),
    receivedAt: new Date().toISOString(),
    request: {
      host: trimToNull(request.headers.get('Host')),
      origin: trimToNull(request.headers.get('Origin')),
      referer: trimToNull(request.headers.get('Referer')),
      secFetchSite: trimToNull(request.headers.get('Sec-Fetch-Site')),
    },
    sessionId: trimToNull(payload.context?.sessionId ?? null),
    type: payload.type ?? 'event',
    userAgent: parseUserAgent(
      trimToNull(request.headers.get('User-Agent')),
      trimToNull(request.headers.get('Sec-CH-UA-Platform')),
    ),
    visitorId,
  }
}

async function parseAnalyticsPayload(request: Request) {
  const rawBody = await request.text()

  if (!rawBody.trim()) {
    return {} as AnalyticsClientPayload
  }

  const parsed = JSON.parse(rawBody) as unknown

  if (!isRecord(parsed)) {
    throw new Error('Analytics payload must be a JSON object')
  }

  return parsed as AnalyticsClientPayload
}

export function defineAnalytics(options: AnalyticsDefinition): AnalyticsDefinition {
  return options
}

export async function handleAnalyticsRequest(request: Request, analytics: AnalyticsDefinition): Promise<Response> {
  const origin = trimToNull(request.headers.get('Origin'))
  const headers = new Headers({
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0, private',
    'Content-Type': 'application/json; charset=utf-8',
    'Pragma': 'no-cache',
  })

  if (!withCorsHeaders(headers, origin, request, analytics)) {
    return new Response(JSON.stringify({ message: 'Forbidden' }), {
      headers,
      status: 403,
    })
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers,
      status: 204,
    })
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ message: 'Method Not Allowed' }), {
      headers,
      status: 405,
    })
  }

  let payload: AnalyticsClientPayload

  try {
    payload = await parseAnalyticsPayload(request)
  } catch (error) {
    return new Response(JSON.stringify({ message: (error as Error).message }), {
      headers,
      status: 400,
    })
  }

  const visitorCookie = getVisitorCookie(analytics)
  const cookieHeader = request.headers.get('Cookie')
  const cookieVisitorId = visitorCookie ? await visitorCookie.parse(cookieHeader) : null
  const payloadVisitorId = trimToNull(payload.context?.visitorId ?? null)
  const visitorId = cookieVisitorId ?? payloadVisitorId ?? randomId()

  if (visitorCookie && cookieVisitorId !== visitorId) {
    await setCookie(headers, visitorCookie, visitorId)
  }

  const event = buildAnalyticsEvent(payload, request, visitorId)
  await analytics.onEvent?.(event, { payload, request })

  return new Response(null, {
    headers,
    status: 204,
  })
}

function shouldUseBeacon(endpoint: string, options: AnalyticsClientOptions) {
  if (typeof window === 'undefined' || typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') {
    return false
  }

  if (options.transport === 'fetch') {
    return false
  }

  const endpointUrl = new URL(endpoint, window.location.origin)

  if (endpointUrl.origin !== window.location.origin) {
    return false
  }

  return options.credentials !== 'include'
}

async function sendAnalyticsPayload(endpoint: string, payload: AnalyticsClientPayload, options: AnalyticsClientOptions) {
  const body = JSON.stringify(payload)

  if (shouldUseBeacon(endpoint, options)) {
    const blob = new Blob([body], {
      type: 'text/plain;charset=UTF-8',
    })

    const queued = navigator.sendBeacon(endpoint, blob)

    if (queued || options.transport === 'beacon') {
      return queued
    }
  }

  if (typeof fetch !== 'function') {
    return false
  }

  const response = await fetch(endpoint, {
    body,
    credentials: options.credentials ?? 'same-origin',
    headers: {
      'Content-Type': 'text/plain;charset=UTF-8',
    },
    keepalive: true,
    method: 'POST',
    mode: typeof window === 'undefined'
      ? 'same-origin'
      : new URL(endpoint, window.location.origin).origin === window.location.origin
        ? 'same-origin'
        : 'cors',
  })

  return response.ok
}

function ensureNavigationEventsPatched() {
  if (typeof window === 'undefined') {
    return
  }

  const patchedKey = '__vorzelajsAnalyticsPatched'

  if ((window as typeof window & Record<string, unknown>)[patchedKey]) {
    return
  }

  for (const methodName of ['pushState', 'replaceState'] as const) {
    const original = window.history[methodName]

    window.history[methodName] = function patchedHistoryState(this: History, ...args: Parameters<typeof original>) {
      const result = original.apply(this, args)
      window.dispatchEvent(new Event(INTERNAL_NAVIGATION_EVENT))
      return result
    }
  }

  ;(window as typeof window & Record<string, unknown>)[patchedKey] = true
}

export function createAnalyticsClient(options: AnalyticsClientOptions = {}): AnalyticsClient {
  const endpoint = options.endpoint ?? DEFAULT_ANALYTICS_ENDPOINT

  const buildPayload = (payload: AnalyticsClientPayload): AnalyticsClientPayload => {
    if (typeof window === 'undefined') {
      return payload
    }

    const touchPoints = ensureTouchPoints(options)
    const context = createClientContext(options)

    return {
      ...payload,
      context: {
        ...context,
        ...payload.context,
      },
      firstTouch: payload.firstTouch ?? touchPoints.firstTouch,
      lastTouch: payload.lastTouch ?? touchPoints.lastTouch,
      pathname: payload.pathname ?? window.location.pathname,
      referrer: payload.referrer ?? document.referrer ?? null,
      search: payload.search ?? window.location.search,
      timestamp: payload.timestamp ?? new Date().toISOString(),
      title: payload.title ?? document.title,
      url: payload.url ?? window.location.href,
    }
  }

  const track = async (payload: AnalyticsClientPayload) => {
    return sendAnalyticsPayload(endpoint, buildPayload(payload), options)
  }

  const pageview: AnalyticsClient['pageview'] = async (payload = {}) => {
    return track({
      ...payload,
      name: 'pageview',
      type: 'pageview',
    })
  }

  const event: AnalyticsClient['event'] = async (name, properties = {}, payload = {}) => {
    return track({
      ...payload,
      name,
      properties,
      type: 'event',
    })
  }

  const startAutoPageviews: AnalyticsClient['startAutoPageviews'] = (startOptions = {}) => {
    if (typeof window === 'undefined') {
      return () => undefined
    }

    ensureNavigationEventsPatched()
    let lastTrackedUrl = ''

    const trackCurrentPage = () => {
      const currentUrl = window.location.href

      if (currentUrl === lastTrackedUrl) {
        return
      }

      lastTrackedUrl = currentUrl
      void pageview()
    }

    const handleNavigation = () => {
      queueMicrotask(trackCurrentPage)
    }

    window.addEventListener(INTERNAL_NAVIGATION_EVENT, handleNavigation)
    window.addEventListener('popstate', handleNavigation)

    if (startOptions.trackInitialPageview !== false) {
      trackCurrentPage()
    }

    return () => {
      window.removeEventListener(INTERNAL_NAVIGATION_EVENT, handleNavigation)
      window.removeEventListener('popstate', handleNavigation)
    }
  }

  return {
    event,
    pageview,
    startAutoPageviews,
    track,
  }
}