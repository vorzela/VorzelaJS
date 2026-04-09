import type { IncomingMessage, ServerResponse } from 'node:http'
import { createServer } from 'node:http'
import { createServer as createNetServer } from 'node:net'
import path from 'node:path'

import { getRequestListener } from '@hono/node-server'
import type { ViteDevServer } from 'vite'

import { createVorzelaApp } from '../server/index.js'
import type { CreateAppOptions } from '../server/index.js'
import { resolveVorzelaConfig } from '../vite/index.js'

type ServerEntryModule = Awaited<ReturnType<CreateAppOptions['loadEntry']>>

async function findAvailablePort(startPort: number) {
  return new Promise<number>((resolve) => {
    const tryPort = (port: number) => {
      const probe = createNetServer()

      probe.once('error', () => {
        tryPort(port + 1)
      })

      probe.once('listening', () => {
        probe.close(() => resolve(port))
      })

      probe.listen(port)
    }

    tryPort(startPort)
  })
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

export async function runDev() {
  const appRoot = process.cwd()
  const port = Number(process.env.PORT ?? 3080)
  const hmrPort = Number(process.env.VORZELA_HMR_PORT ?? 24678)

  const { vorzelaServerOnlyPlugin } = await import('../vite/server-only.js')
  const solidPlugin = await import('vite-plugin-solid').then((m) => m.default).catch(() => null)

  const baseConfig = await resolveVorzelaConfig(appRoot)

  const { createServer: createViteServer } = await import('vite')
  const resolvedHmrPort = await findAvailablePort(hmrPort)

  const vite = await createViteServer({
    ...baseConfig,
    appType: 'custom',
    server: {
      hmr: {
        port: resolvedHmrPort,
      },
      middlewareMode: true,
    },
  })

  const devAssets = {
    css: ['/src/styles.css'],
    js: ['/src/entry-client.tsx'],
  }

  const loadEntry: CreateAppOptions['loadEntry'] = async () => {
    return vite.ssrLoadModule('virtual:vorzela/entry-server') as Promise<ServerEntryModule>
  }

  const app = createVorzelaApp({
    assets: devAssets,
    isProd: false,
    loadEntry,
    vite,
  })

  const listener = getRequestListener(app.fetch)

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
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
  })

  const resolvedPort = await listenOnAvailablePort(server, port)
  console.info(`VorzelaJs running at http://localhost:${resolvedPort} (HMR ${resolvedHmrPort})`)
  console.info(`[VorzelaJs][dev] document=* payload=/__vorzela/payload analytics=/api/analytics robots=/robots.txt sitemap=/sitemap.xml`)
}
