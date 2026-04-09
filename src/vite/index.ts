import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

import type { Plugin, UserConfig } from 'vite'

import { vorzelaRoutesPlugin } from './routes-plugin.js'
import { vorzelaServerOnlyPlugin } from './server-only.js'

const VIRTUAL_ROUTES = 'virtual:vorzela/routes'
const VIRTUAL_HYDRATION = 'virtual:vorzela/hydration'
const VIRTUAL_STYLES = 'virtual:vorzela/styles'
const VIRTUAL_ENTRY_CLIENT = 'virtual:vorzela/entry-client'
const VIRTUAL_ENTRY_SERVER = 'virtual:vorzela/entry-server'

const RESOLVED_VIRTUAL_ROUTES = `\0${VIRTUAL_ROUTES}`
const RESOLVED_VIRTUAL_HYDRATION = `\0${VIRTUAL_HYDRATION}`
const RESOLVED_VIRTUAL_STYLES = `\0${VIRTUAL_STYLES}`
const RESOLVED_VIRTUAL_ENTRY_CLIENT = `\0${VIRTUAL_ENTRY_CLIENT}`
const RESOLVED_VIRTUAL_ENTRY_SERVER = `\0${VIRTUAL_ENTRY_SERVER}`

export interface VorzelaPluginOptions {
  /** Override the Solid plugin. Pass `false` to disable auto-detection. */
  solid?: false | Plugin
  /** Override the Tailwind plugin. Pass `false` to disable auto-detection. */
  tailwind?: false | Plugin
}

function resolveFrameworkDir() {
  const thisFile = url.fileURLToPath(import.meta.url)
  // In built form: dist/vite/index.js -> dist/
  // In source form: src/vite/index.ts -> src/
  return path.resolve(path.dirname(thisFile), '..')
}

function resolveInternalEntryPath(frameworkDir: string, entryName: 'entry-client' | 'entry-server') {
  const thisFile = url.fileURLToPath(import.meta.url)
  const internalExtension = path.extname(thisFile) === '.js' ? '.jsx' : '.tsx'

  return path.resolve(frameworkDir, `internal/${entryName}${internalExtension}`)
}

function tryRequirePlugin(name: string): Plugin | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(name)
    return typeof mod === 'function' ? mod() : typeof mod.default === 'function' ? mod.default() : null
  } catch {
    return null
  }
}

async function tryImportPlugin(name: string): Promise<Plugin | null> {
  try {
    const mod = await import(name)
    const fn = mod.default ?? mod
    return typeof fn === 'function' ? fn() : null
  } catch {
    return null
  }
}

function vorzelaVirtualModulesPlugin(): Plugin {
  let appRoot = process.cwd()
  let frameworkDir = resolveFrameworkDir()

  return {
    name: 'vorzelajs-virtual-modules',
    enforce: 'pre',
    configResolved(config) {
      appRoot = config.root
    },
    resolveId(id) {
      switch (id) {
        case VIRTUAL_ROUTES:
          return RESOLVED_VIRTUAL_ROUTES
        case VIRTUAL_HYDRATION:
          return RESOLVED_VIRTUAL_HYDRATION
        case VIRTUAL_STYLES:
          return RESOLVED_VIRTUAL_STYLES
        case VIRTUAL_ENTRY_CLIENT:
          return RESOLVED_VIRTUAL_ENTRY_CLIENT
        case VIRTUAL_ENTRY_SERVER:
          return RESOLVED_VIRTUAL_ENTRY_SERVER
        default:
          return null
      }
    },
    load(id) {
      switch (id) {
        case RESOLVED_VIRTUAL_ROUTES: {
          const routeTreePath = path.resolve(appRoot, 'src/routeTree.gen.ts')
          return `export * from ${JSON.stringify(routeTreePath)}`
        }
        case RESOLVED_VIRTUAL_HYDRATION: {
          const hydrationPath = path.resolve(appRoot, 'src/routeHydration.gen.ts')
          return `export * from ${JSON.stringify(hydrationPath)}`
        }
        case RESOLVED_VIRTUAL_STYLES: {
          const stylesPath = path.resolve(appRoot, 'src/styles.css')
          return `import ${JSON.stringify(stylesPath)}`
        }
        case RESOLVED_VIRTUAL_ENTRY_CLIENT: {
          const entryPath = resolveInternalEntryPath(frameworkDir, 'entry-client')
          return `export * from ${JSON.stringify(entryPath)}`
        }
        case RESOLVED_VIRTUAL_ENTRY_SERVER: {
          const entryPath = resolveInternalEntryPath(frameworkDir, 'entry-server')
          return `export * from ${JSON.stringify(entryPath)}`
        }
        default:
          return null
      }
    },
  }
}

export function vorzelaPlugin(options: VorzelaPluginOptions = {}): Plugin[] {
  const plugins: Plugin[] = [
    vorzelaVirtualModulesPlugin(),
    vorzelaRoutesPlugin(),
  ]

  return plugins
}

export async function resolveVorzelaConfig(
  appRoot: string,
  options: VorzelaPluginOptions = {},
): Promise<UserConfig> {
  const plugins: Plugin[] = [...vorzelaPlugin(options)]

  // Auto-detect Solid plugin
  if (options.solid !== false) {
    if (options.solid) {
      plugins.push(options.solid)
    } else {
      const solidPlugin = await tryImportPlugin('vite-plugin-solid')
      if (solidPlugin) {
        plugins.push(solidPlugin)
      }
    }
  }

  // Auto-detect Tailwind plugin
  if (options.tailwind !== false) {
    if (options.tailwind) {
      plugins.push(options.tailwind)
    } else {
      const tailwindPlugin = await tryImportPlugin('@tailwindcss/vite')
      if (tailwindPlugin) {
        plugins.push(tailwindPlugin)
      }
    }
  }

  return {
    root: appRoot,
    resolve: {
      alias: {
        '~': path.resolve(appRoot, 'src'),
      },
    },
    plugins,
  }
}

export function resolveVorzelalBuildConfig(
  appRoot: string,
  mode: 'client' | 'server',
): UserConfig {
  if (mode === 'server') {
    return {
      build: {
        outDir: 'dist/server',
        emptyOutDir: false,
        copyPublicDir: false,
        ssr: true,
        rollupOptions: {
          input: VIRTUAL_ENTRY_SERVER,
          output: {
            entryFileNames: 'entry-server.js',
            chunkFileNames: 'chunks/[name]-[hash].js',
            assetFileNames: 'assets/[name]-[hash][extname]',
          },
        },
      },
    }
  }

  return {
    build: {
      cssCodeSplit: false,
      outDir: 'dist/client',
      emptyOutDir: true,
      copyPublicDir: true,
      manifest: true,
      rollupOptions: {
        input: VIRTUAL_ENTRY_CLIENT,
        output: {
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
      },
    },
  }
}

export { generateRoutes, vorzelaRoutesPlugin } from './routes-plugin.js'
export { vorzelaServerOnlyPlugin } from './server-only.js'
