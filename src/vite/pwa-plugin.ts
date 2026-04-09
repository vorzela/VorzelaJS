import type { Plugin } from 'vite'

import { generateOfflinePage } from '../pwa/offline-template.js'
import { generateServiceWorker } from '../pwa/sw-template.js'
import type { ResolvedPwaConfig } from './index.js'

let _activePwaConfig: ResolvedPwaConfig | null = null

/** Returns the PWA config if the plugin is active, null otherwise */
export function getActivePwaConfig(): ResolvedPwaConfig | null {
  return _activePwaConfig
}

function generateManifestJson(config: ResolvedPwaConfig): string {
  return JSON.stringify({
    name: config.name,
    short_name: config.shortName,
    start_url: '/',
    display: config.display,
    background_color: config.backgroundColor,
    theme_color: config.themeColor,
    icons: config.icons,
  }, null, 2)
}

export function vorzelaPwaPlugin(config: ResolvedPwaConfig): Plugin {
  let isBuild = false

  return {
    name: 'vorzelajs-pwa',
    configResolved(resolved) {
      isBuild = resolved.command === 'build'
      _activePwaConfig = config
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/manifest.webmanifest') {
          res.setHeader('Content-Type', 'application/manifest+json')
          res.setHeader('Cache-Control', 'no-cache')
          res.end(generateManifestJson(config))
          return
        }
        next()
      })
    },
    generateBundle(_, bundle) {
      if (!isBuild) return

      // Collect all asset URLs from the bundle
      const assetUrls: string[] = []
      for (const fileName of Object.keys(bundle)) {
        assetUrls.push(`/${fileName}`)
      }

      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: generateServiceWorker(assetUrls),
      })

      this.emitFile({
        type: 'asset',
        fileName: 'manifest.webmanifest',
        source: generateManifestJson(config),
      })

      this.emitFile({
        type: 'asset',
        fileName: 'offline.html',
        source: generateOfflinePage(config),
      })
    },
  }
}

export { generateManifestJson }
