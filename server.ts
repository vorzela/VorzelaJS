import fs from 'node:fs/promises'
import { createServer } from 'node:http'
import { createServer as createNetServer } from 'node:net'
import path from 'node:path'
import url from 'node:url'

import { getRequestListener } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'

import { isRedirect } from './src/router/navigation'

import type { IncomingMessage, ServerResponse } from 'node:http'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const isProd = process.env.NODE_ENV === 'production'
const initialPort = Number(process.env.PORT ?? 3080)
const initialHmrPort = Number(process.env.VORZELA_HMR_PORT ?? 24678)

interface ClientManifestEntry {
  file: string
  css?: string[]
}

interface RenderAssets {
  css: string[]
  js: string[]
}

interface ServerEntryModule {
  renderDocument(input: { assets: RenderAssets; request: Request }): Promise<Response>
  renderPayload(input: { path: string; request: Request }): Promise<{
    head: Record<string, unknown>
    html: string
    matches: Array<Record<string, unknown>>
    pathname: string
    search: string
    routeError?: Record<string, unknown>
    status: 200 | 404 | 500
  }>
}

type Bindings = {
  incoming: IncomingMessage
  outgoing: ServerResponse
}

async function isPortAvailable(port: number) {
  return new Promise<boolean>((resolve) => {
    const probe = createNetServer()

    probe.once('error', () => {
      resolve(false)
    })

    probe.once('listening', () => {
      probe.close(() => resolve(true))
    })

    probe.listen(port)
  })
}

async function findAvailablePort(startPort: number) {
  let nextPort = startPort

  while (!(await isPortAvailable(nextPort))) {
    console.warn(`Port ${nextPort} is in use. Trying ${nextPort + 1}...`)
    nextPort += 1
  }

  return nextPort
}

async function listenOnAvailablePort(server: ReturnType<typeof createServer>, startPort: number) {
  return new Promise<number>((resolve, reject) => {
    const tryListen = (candidatePort: number) => {
      const handleError = (error: NodeJS.ErrnoException) => {
        server.off('listening', handleListening)

        if (error.code === 'EADDRINUSE') {
          console.warn(`Port ${candidatePort} is in use. Trying ${candidatePort + 1}...`)
          tryListen(candidatePort + 1)
          return
        }

        reject(error)
      }

      const handleListening = () => {
        server.off('error', handleError)
        resolve(candidatePort)
      }

      server.once('error', handleError)
      server.once('listening', handleListening)
      server.listen(candidatePort)
    }

    tryListen(startPort)
  })
}

async function createApp() {
  const app = new Hono<{ Bindings: Bindings }>()
  let vite: Awaited<ReturnType<typeof import('vite')['createServer']>> | null = null
  let hmrPort: number | null = null

  let assets: RenderAssets = {
    css: ['/src/styles.css'],
    js: ['/src/entry-client.tsx'],
  }

  if (!isProd) {
    const { createServer } = await import('vite')
    hmrPort = await findAvailablePort(initialHmrPort)

    vite = await createServer({
      root: __dirname,
      appType: 'custom',
      server: {
        hmr: {
          port: hmrPort,
        },
        middlewareMode: true,
      },
    })
  } else {
    const manifestPath = path.resolve(__dirname, 'dist/client/.vite/manifest.json')
    const manifest = JSON.parse(
      await fs.readFile(manifestPath, 'utf-8'),
    ) as Record<string, ClientManifestEntry>
    const entry = manifest['src/entry-client.tsx']

    assets = {
      css: (entry?.css ?? []).map((href) => `/${href}`),
      js: entry ? [`/${entry.file}`] : [],
    }

    app.use('/assets/*', serveStatic({ root: './dist/client' }))
    app.use('/favicon.svg', serveStatic({ root: './dist/client' }))
    app.use('/robots.txt', serveStatic({ root: './dist/client' }))
  }

  if (!isProd) {
    app.use('/favicon.svg', serveStatic({ root: './public' }))
    app.use('/robots.txt', serveStatic({ root: './public' }))
  }

  app.use('*', async (c, next) => {
    await next()
    c.res.headers.set('X-Content-Type-Options', 'nosniff')
    c.res.headers.set('X-Frame-Options', 'DENY')
    c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    c.res.headers.set('Cross-Origin-Opener-Policy', 'same-origin')
    c.res.headers.set('Cross-Origin-Resource-Policy', 'same-origin')
    c.res.headers.set('Permissions-Policy', 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()')
    c.res.headers.set('Content-Security-Policy', isProd
      ? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
      : "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' ws: wss:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'")
    if (isProd) {
      c.res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
    }
  })

  app.get('/favicon.ico', (c) => c.redirect('/favicon.svg', 302))

  const loadEntry = async (): Promise<ServerEntryModule> => {
    return isProd
      ? (
          // @ts-expect-error built at compile time
          await import('./dist/server/entry-server.js')
        ) as ServerEntryModule
      : (await vite!.ssrLoadModule('/src/entry-server.tsx')) as ServerEntryModule
  }

  app.get('/__vorzela/payload', async (c) => {
    try {
      const path = c.req.query('path') ?? '/'
      const entry = await loadEntry()

      const payload = await entry.renderPayload({
        path,
        request: c.req.raw,
      })

      return c.json(payload, { status: payload.status })
    } catch (error) {
      if (isRedirect(error)) {
        return c.redirect(error.to, error.status)
      }

      if (!isProd && vite) {
        vite.ssrFixStacktrace(error as Error)
      }

      console.error(error)
      return c.json({ message: 'Internal Server Error' }, 500)
    }
  })

  app.get('*', async (c) => {
    try {
      const entry = await loadEntry()

      return await entry.renderDocument({
        request: c.req.raw,
        assets,
      })
    } catch (error) {
      if (isRedirect(error)) {
        return c.redirect(error.to, error.status)
      }

      if (!isProd && vite) {
        vite.ssrFixStacktrace(error as Error)
      }

      console.error(error)
      return c.text('Internal Server Error', 500)
    }
  })

  return { app, hmrPort, vite }
}

createApp().then(async ({ app, hmrPort, vite }) => {
  const listener = getRequestListener(app.fetch)

  const server = createServer((req, res) => {
    if (vite) {
      vite.middlewares(req, res, (error?: Error) => {
        if (error) {
          vite.ssrFixStacktrace(error)
          res.statusCode = 500
          res.end(error.stack ?? String(error))
          return
        }

        if (!res.writableEnded) {
          void listener(req, res)
        }
      })
      return
    }

    void listener(req, res)
  })

  const resolvedPort = await listenOnAvailablePort(server, initialPort)
  const hmrSuffix = hmrPort ? ` (HMR ${hmrPort})` : ''
  console.info(`VorzelaJs running at http://localhost:${resolvedPort}${hmrSuffix}`)
}).catch((error) => {
  console.error(error)
  process.exitCode = 1
})