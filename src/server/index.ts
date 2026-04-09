import { randomBytes } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'

import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import type { ViteDevServer } from 'vite'

import type { AnalyticsDefinition } from '../analytics.js'
import { DEFAULT_ANALYTICS_ENDPOINT, handleAnalyticsRequest } from '../analytics.js'
import { formatParsedStack, parseErrorStack } from '../debug/error-stack.js'
import { isRedirect } from '../runtime/navigation.js'
import type { RobotsConfig } from '../seo.js'
import { defaultRobotsConfig, renderRobotsTxt } from '../seo.js'
import type { RenderAssets } from '../runtime/index.js'

type Bindings = {
  incoming: IncomingMessage
  outgoing: ServerResponse
}

interface ServerEntryModule {
  analytics?: AnalyticsDefinition
  getSitemapEntries?: () => Promise<Array<{ loc: string; lastmod?: string; changefreq?: string; priority?: number }>>
  renderDocument(input: { assets: RenderAssets; nonce?: string; request: Request }): Promise<Response>
  renderPayload(input: { path: string; request: Request }): Promise<{
    head: Record<string, unknown>
    html: string
    matches: Array<Record<string, unknown>>
    pathname: string
    responseHeaders?: Headers
    search: string
    routeError?: Record<string, unknown>
    status: 200 | 404 | 500
  }>
  robotsConfig?: RobotsConfig
}

export interface CreateAppOptions {
  assets: RenderAssets
  isProd: boolean
  loadEntry: () => Promise<ServerEntryModule>
  staticRoot?: string
  vite?: ViteDevServer
}

function logDevRequest(
  kind: string,
  request: Request,
  status: number,
  startedAt: number,
  isProd: boolean,
  meta: Record<string, unknown> = {},
) {
  if (isProd) return

  const url = new URL(request.url)
  const duration = Date.now() - startedAt
  const suffix = Object.entries(meta)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(' ')

  console.info(
    `[VorzelaJs][dev] ${kind.padEnd(9)} ${request.method.padEnd(6)} ${String(status).padStart(3)} ${url.pathname}${url.search} ${duration}ms${suffix ? ` ${suffix}` : ''}`,
  )
}

function logDevError(scope: string, error: unknown, isProd: boolean, meta: Record<string, unknown> = {}) {
  if (isProd) return

  const parsedStack = parseErrorStack(error)

  console.groupCollapsed(`[VorzelaJs][dev:${scope}] ${error instanceof Error ? error.message : 'Unexpected error'}`)
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

function escapeXml(value: string) {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&apos;')
}

export function createVorzelaApp(options: CreateAppOptions) {
  const { assets, isProd, loadEntry, staticRoot, vite } = options
  const app = new Hono<{ Bindings: Bindings; Variables: { cspNonce: string } }>()

  // Static asset serving
  if (isProd && staticRoot) {
    app.use('/assets/*', serveStatic({ root: './dist/client' }))
    app.use('/favicon.svg', serveStatic({ root: './dist/client' }))
  }

  if (!isProd) {
    app.use('/favicon.svg', serveStatic({ root: './public' }))
  }

  const assetNotFound = (request: Request) => {
    const startedAt = Date.now()
    logDevRequest('asset', request, 404, startedAt, isProd, { reason: 'missing-static-asset' })

    return new Response('Asset Not Found', {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'text/plain; charset=utf-8',
      },
      status: 404,
    })
  }

  if (isProd) {
    app.all('/assets/*', (c) => assetNotFound(c.req.raw))
  }

  // Security headers
  app.use('*', async (c, next) => {
    const cspNonce = randomBytes(16).toString('base64')

    c.set('cspNonce', cspNonce)
    await next()
    c.res.headers.set('X-Content-Type-Options', 'nosniff')
    c.res.headers.set('X-Frame-Options', 'DENY')
    c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    c.res.headers.set('Cross-Origin-Opener-Policy', 'same-origin')
    c.res.headers.set('Cross-Origin-Resource-Policy', 'same-origin')
    c.res.headers.set('Permissions-Policy', 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()')
    c.res.headers.set('X-Robots-Tag', 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1')
    c.res.headers.set('Content-Security-Policy', isProd
      ? `default-src 'self'; script-src 'self' 'nonce-${cspNonce}'; style-src 'self'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`
      : "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' ws: wss:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'")
    if (isProd) {
      c.res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
    }
  })

  // Favicon redirect
  app.get('/favicon.ico', (c) => c.redirect('/favicon.svg', 302))

  // Analytics
  const analyticsHandler = async (request: Request) => {
    const startedAt = Date.now()
    const entry = await loadEntry()

    if (!entry.analytics) {
      const response = new Response(JSON.stringify({ message: 'Not Found' }), {
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        status: 404,
      })

      logDevRequest('analytics', request, response.status, startedAt, isProd)
      return response
    }

    const response = await handleAnalyticsRequest(request, entry.analytics)
    logDevRequest('analytics', request, response.status, startedAt, isProd)
    return response
  }

  app.options(DEFAULT_ANALYTICS_ENDPOINT, async (c) => analyticsHandler(c.req.raw))
  app.post(DEFAULT_ANALYTICS_ENDPOINT, async (c) => analyticsHandler(c.req.raw))

  // Robots.txt
  app.get('/robots.txt', async (c) => {
    const startedAt = Date.now()
    const entry = await loadEntry()
    const config = entry.robotsConfig ?? defaultRobotsConfig()
    const body = renderRobotsTxt(config)

    c.header('Content-Type', 'text/plain; charset=utf-8')
    c.header('Cache-Control', 'public, max-age=3600')
    logDevRequest('robots', c.req.raw, 200, startedAt, isProd)
    return c.text(body)
  })

  // Sitemap
  app.get('/sitemap.xml', async (c) => {
    const startedAt = Date.now()
    const entry = await loadEntry()
    const entries = entry.getSitemapEntries ? await entry.getSitemapEntries() : []

    const items = entries.map((item) => {
      const parts = [`    <loc>${escapeXml(item.loc)}</loc>`]
      if (item.lastmod) parts.push(`    <lastmod>${escapeXml(item.lastmod)}</lastmod>`)
      if (item.changefreq) parts.push(`    <changefreq>${escapeXml(item.changefreq)}</changefreq>`)
      if (item.priority !== undefined) parts.push(`    <priority>${item.priority}</priority>`)
      return `  <url>\n${parts.join('\n')}\n  </url>`
    })

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...items,
      '</urlset>',
    ].join('\n')

    c.header('Content-Type', 'application/xml; charset=utf-8')
    c.header('Cache-Control', 'public, max-age=3600')
    logDevRequest('sitemap', c.req.raw, 200, startedAt, isProd, { entries: entries.length })
    return c.text(xml)
  })

  // Payload endpoint (client navigation)
  app.get('/__vorzela/payload', async (c) => {
    const startedAt = Date.now()
    const navigationHeader = c.req.header('X-Vorzela-Navigation')

    if (navigationHeader !== 'payload') {
      logDevRequest('payload', c.req.raw, 403, startedAt, isProd, { reason: 'missing-navigation-header' })
      return c.json({ message: 'Forbidden' }, 403)
    }

    if (isProd) {
      const origin = c.req.header('Origin')
      const referer = c.req.header('Referer')
      const host = c.req.header('Host')

      if (origin) {
        try {
          const originHost = new URL(origin).host
          if (host && originHost !== host) {
            logDevRequest('payload', c.req.raw, 403, startedAt, isProd, { reason: 'origin-mismatch' })
            return c.json({ message: 'Forbidden' }, 403)
          }
        } catch {
          logDevRequest('payload', c.req.raw, 403, startedAt, isProd, { reason: 'invalid-origin' })
          return c.json({ message: 'Forbidden' }, 403)
        }
      } else if (referer) {
        try {
          const refererHost = new URL(referer).host
          if (host && refererHost !== host) {
            logDevRequest('payload', c.req.raw, 403, startedAt, isProd, { reason: 'referer-mismatch' })
            return c.json({ message: 'Forbidden' }, 403)
          }
        } catch {
          logDevRequest('payload', c.req.raw, 403, startedAt, isProd, { reason: 'invalid-referer' })
          return c.json({ message: 'Forbidden' }, 403)
        }
      } else {
        logDevRequest('payload', c.req.raw, 403, startedAt, isProd, { reason: 'missing-origin-and-referer' })
        return c.json({ message: 'Forbidden' }, 403)
      }
    }

    try {
      const routePath = c.req.query('path') ?? '/'
      const entry = await loadEntry()

      const payload = await entry.renderPayload({
        path: routePath,
        request: c.req.raw,
      })

      c.header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0, private')
      c.header('Pragma', 'no-cache')
      c.header('Expires', '0')

      if (payload.responseHeaders) {
        for (const [key, value] of payload.responseHeaders) {
          c.header(key, value, { append: true })
        }
      }

      const { responseHeaders: _, ...jsonPayload } = payload
      logDevRequest('payload', c.req.raw, payload.status, startedAt, isProd, {
        path: routePath,
        status: payload.status,
      })
      return c.json(jsonPayload, { status: payload.status })
    } catch (error) {
      if (isRedirect(error)) {
        c.header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0, private')
        c.header('Pragma', 'no-cache')
        c.header('Expires', '0')

        logDevRequest('payload', c.req.raw, error.status, startedAt, isProd, {
          redirect: error.to,
        })

        return c.json({
          redirect: {
            replace: error.replace,
            status: error.status,
            to: error.to,
          },
        }, { status: error.status })
      }

      if (!isProd && vite) {
        vite.ssrFixStacktrace(error as Error)
      }

      logDevError('payload', error, isProd, {
        path: c.req.query('path') ?? '/',
      })
      console.error(error)
      c.header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0, private')
      c.header('Pragma', 'no-cache')
      c.header('Expires', '0')
      logDevRequest('payload', c.req.raw, 500, startedAt, isProd)
      return c.json({ message: 'Internal Server Error' }, 500)
    }
  })

  // Document SSR (catch-all)
  app.get('*', async (c) => {
    const startedAt = Date.now()
    try {
      const entry = await loadEntry()

      const response = await entry.renderDocument({
        request: c.req.raw,
        assets,
        nonce: c.get('cspNonce'),
      })

      logDevRequest('document', c.req.raw, response.status, startedAt, isProd)
      return response
    } catch (error) {
      if (isRedirect(error)) {
        logDevRequest('document', c.req.raw, error.status, startedAt, isProd, { redirect: error.to })
        return c.redirect(error.to, error.status)
      }

      if (!isProd && vite) {
        vite.ssrFixStacktrace(error as Error)
      }

      logDevError('document', error, isProd, {
        path: new URL(c.req.raw.url).pathname,
      })
      console.error(error)
      logDevRequest('document', c.req.raw, 500, startedAt, isProd)
      return c.text('Internal Server Error', 500)
    }
  })

  return app
}
