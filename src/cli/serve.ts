import fs from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'

import { getRequestListener } from '@hono/node-server'

import { createVorzelaApp } from '../server/index.js'
import type { RenderAssets } from '../runtime/index.js'

interface ClientManifestEntry {
  assets?: string[]
  isEntry?: boolean
  src?: string
  file: string
  css?: string[]
}

export async function runServe() {
  const appRoot = process.cwd()
  const port = Number(process.env.PORT ?? 3080)

  const manifestPath = path.resolve(appRoot, 'dist/client/.vite/manifest.json')
  const manifest = JSON.parse(
    await fs.readFile(manifestPath, 'utf-8'),
  ) as Record<string, ClientManifestEntry>

  // Find entry point — look for virtual entry first, then direct entry
  const entry = manifest['virtual:vorzela/entry-client']
    ?? manifest['src/entry-client.tsx']
  const cssAssets = new Set<string>()

  entry?.css?.forEach((href) => {
    cssAssets.add(href)
  })

  for (const manifestEntry of Object.values(manifest)) {
    if (manifestEntry.file.endsWith('.css')) {
      cssAssets.add(manifestEntry.file)
    }
  }

  const assets: RenderAssets = {
    css: [...cssAssets].map((href) => `/${href}`),
    js: entry ? [`/${entry.file}`] : [],
  }

  // Detect PWA: if manifest.webmanifest was generated during build, enable PWA in assets
  const manifestWebPath = path.resolve(appRoot, 'dist/client/manifest.webmanifest')
  try {
    const manifestWeb = JSON.parse(await fs.readFile(manifestWebPath, 'utf-8')) as { theme_color?: string }
    assets.pwa = { themeColor: manifestWeb.theme_color ?? '#09111f' }
  } catch {
    // No PWA manifest — PWA not enabled
  }

  const serverEntryPath = path.resolve(appRoot, 'dist/server/entry-server.js')
  const serverEntry = await import(serverEntryPath)

  const loadEntry = async () => serverEntry

  const app = createVorzelaApp({
    assets,
    isProd: true,
    loadEntry,
    staticRoot: path.resolve(appRoot, 'dist/client'),
  })

  const listener = getRequestListener(app.fetch)

  const server = createServer((req, res) => {
    void listener(req, res)
  })

  server.listen(port, () => {
    console.info(`VorzelaJs running at http://localhost:${port}`)
  })
}
