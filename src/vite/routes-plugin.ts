import fs from 'node:fs/promises'
import path from 'node:path'

import type { Plugin } from 'vite'

const ROUTES_DIR = path.join('src', 'routes')
const SOURCE_DIR = 'src'
const OUTPUT_FILE = path.join('src', 'routeTree.gen.ts')
const OUTPUT_HYDRATION_FILE = path.join('src', 'routeHydration.gen.ts')
const ROUTE_FILE_PATTERN = /\.(ts|tsx)$/u
const SERVER_ONLY_ROUTE_FILE_PATTERN = /\.server\.(ts|tsx)$/u
const SERVER_ONLY_DIR_PATTERN = /[\\/]\.server[\\/]/u
const SERVER_ONLY_SPECIFIER_PATTERN = /(?:^|[\\/])\.server(?:[\\/]|$)|\.server(?:$|\.)/u

const CLIENT_EVENT_HANDLER_PATTERN = /\bon[A-Z][A-Za-z0-9]*\s*=/u
const CLIENT_ROUTER_HOOK_PATTERN = /\b(useNavigate|useSetSearch|Route\.useSetSearch)\b/u
const CLIENT_SOLID_HOOK_PATTERN = /\b(createSignal|createEffect|createRenderEffect|createResource|onMount|onCleanup)\b/u
const CLIENT_BROWSER_GLOBAL_PATTERN = /\b(window|document|navigator|localStorage|sessionStorage)\s*\./u
const CLIENT_BROWSER_FUNCTION_PATTERN = /\b(requestAnimationFrame|matchMedia)\s*\(/u
const SOURCE_FILE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'] as const
const IMPORT_EXPORT_PATTERN = /\b(?:import|export)\s+(?!type\b)[\w\s{},*]+?\s+from\s+['"]([^'"]+)['"]/gu
const SIDE_EFFECT_IMPORT_PATTERN = /\bimport\s+['"]([^'"]+)['"]/gu
const DYNAMIC_IMPORT_PATTERN = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/gu

type RouteInfo = {
  filePath: string
  fullPath: string
  id: string
  importPath: string
  matchPath: string | null
  parentId: string | null
  sourcePath: string
  to: string
  isPathlessFile: boolean
}

function toPosix(value: string) {
  return value.split(path.sep).join('/')
}

function isPathlessSegment(segment: string) {
  return segment.startsWith('_') && segment !== '__root'
}

function isServerOnlyRouteFile(filePath: string) {
  return SERVER_ONLY_ROUTE_FILE_PATTERN.test(filePath) || SERVER_ONLY_DIR_PATTERN.test(filePath)
}

function isServerOnlyModuleSpecifier(specifier: string) {
  return SERVER_ONLY_SPECIFIER_PATTERN.test(specifier)
}

async function walkFiles(dirPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    const nestedFiles = await Promise.all(entries.map(async (entry) => {
      const fullPath = path.join(dirPath, entry.name)

      if (entry.isDirectory()) {
        return walkFiles(fullPath)
      }

      return entry.isFile() ? [fullPath] : []
    }))

    return nestedFiles.flat()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }

    throw error
  }
}

function getRouteInfo(filePath: string, routesDir: string): RouteInfo {
  const relativePath = toPosix(path.relative(routesDir, filePath))
  const withoutExtension = relativePath.replace(ROUTE_FILE_PATTERN, '')
  const importPath = `./routes/${withoutExtension}`

  if (withoutExtension === '__root') {
    return {
      filePath,
      fullPath: '/',
      id: '__root__',
      importPath,
      matchPath: null,
      parentId: null,
      sourcePath: withoutExtension,
      to: '/',
      isPathlessFile: false,
    }
  }

  const segments = withoutExtension.split('/')
  const isIndex = segments[segments.length - 1] === 'index'
  const fileSegment = segments[segments.length - 1]
  const directorySegments = segments.slice(0, -1)
  const publicDirectorySegments = directorySegments.filter((segment) => !isPathlessSegment(segment))
  const isPathlessFile = isPathlessSegment(fileSegment)
  const publicSegments = isIndex || isPathlessFile
    ? publicDirectorySegments
    : [...publicDirectorySegments, fileSegment]
  const fullPath = publicSegments.length > 0 ? `/${publicSegments.join('/')}` : '/'
  const id = withoutExtension === 'index'
    ? '/'
    : isIndex
      ? `/${directorySegments.join('/')}/`
      : `/${withoutExtension}`

  return {
    filePath,
    fullPath,
    id,
    importPath,
    matchPath: isPathlessFile ? null : fullPath,
    parentId: '__root__',
    sourcePath: withoutExtension,
    to: fullPath,
    isPathlessFile,
  }
}

function findParentRouteId(route: RouteInfo, routesBySourcePath: Map<string, RouteInfo>) {
  if (route.id === '__root__') {
    return null
  }

  const sourceSegments = route.sourcePath.split('/')
  const directorySegments = sourceSegments.slice(0, -1)

  for (let depth = directorySegments.length; depth > 0; depth -= 1) {
    const candidateSourcePath = directorySegments.slice(0, depth).join('/')
    const candidateRoute = routesBySourcePath.get(candidateSourcePath)

    if (candidateRoute?.isPathlessFile) {
      return candidateRoute.id
    }
  }

  return '__root__'
}

function assertNoDuplicateMatchPaths(routes: RouteInfo[]) {
  const seen = new Map<string, string>()

  routes.forEach((route) => {
    if (!route.matchPath) {
      return
    }

    const existing = seen.get(route.matchPath)

    if (existing) {
      throw new Error(`Duplicate routable path '${route.matchPath}' detected for '${existing}' and '${route.sourcePath}'`)
    }

    seen.set(route.matchPath, route.sourcePath)
  })
}

function createGeneratedFile(routes: RouteInfo[]) {
  const sortedRoutes = [...routes].sort((left, right) => {
    if (left.id === '__root__') return -1
    if (right.id === '__root__') return 1
    return left.id.localeCompare(right.id)
  })

  const routesById = sortedRoutes
    .map((route) => `  '${route.id}': typeof import('${route.importPath}')['Route']`)
    .join('\n')

  const routesByFullPath = sortedRoutes
    .filter((route) => route.id !== '__root__' && route.matchPath !== null)
    .map((route) => `  '${route.fullPath}': typeof import('${route.importPath}')['Route']`)
    .join('\n')

  const routesByTo = sortedRoutes
    .filter((route) => route.id !== '__root__' && route.matchPath !== null)
    .map((route) => `  '${route.to}': typeof import('${route.importPath}')['Route']`)
    .join('\n')

  const manifestEntries = sortedRoutes.map((route) => `  {
    id: '${route.id}',
    fullPath: '${route.fullPath}',
    matchPath: ${route.matchPath ? `'${route.matchPath}'` : 'null'},
    to: '${route.to}',
    parentId: ${route.parentId ? `'${route.parentId}'` : 'null'},
    importPath: '${route.importPath}',
    loadRoute: () => import('${route.importPath}'),
  }`).join(',\n')

  return `/* eslint-disable */

// @ts-nocheck

// This file was automatically generated by VorzelaJs.
// Do not edit this file manually.

import type { GeneratedRouteRecord } from 'vorzelajs'

export const routeManifest = [
${manifestEntries}
] as const satisfies readonly GeneratedRouteRecord[]

export interface FileRoutesById {
${routesById}
}

export interface FileRoutesByFullPath {
${routesByFullPath}
}

export interface FileRoutesByTo {
${routesByTo}
}

export type RouteId = keyof FileRoutesById
export type RouteFullPath = keyof FileRoutesByFullPath
export type RouteTo = keyof FileRoutesByTo
`
}

function detectRouteHydration(source: string) {
  return CLIENT_EVENT_HANDLER_PATTERN.test(source)
    || CLIENT_ROUTER_HOOK_PATTERN.test(source)
    || CLIENT_SOLID_HOOK_PATTERN.test(source)
    || CLIENT_BROWSER_GLOBAL_PATTERN.test(source)
    || CLIENT_BROWSER_FUNCTION_PATTERN.test(source)
    ? 'client'
    : 'static'
}

function isHydrationTrackedSpecifier(specifier: string) {
  return specifier.startsWith('./')
    || specifier.startsWith('../')
    || specifier === '~'
    || specifier.startsWith('~/')
}

function extractLocalImportSpecifiers(source: string) {
  const specifiers = new Set<string>()

  for (const pattern of [IMPORT_EXPORT_PATTERN, SIDE_EFFECT_IMPORT_PATTERN, DYNAMIC_IMPORT_PATTERN]) {
    pattern.lastIndex = 0

    for (const match of source.matchAll(pattern)) {
      const specifier = match[1]

      if (specifier && isHydrationTrackedSpecifier(specifier) && !isServerOnlyModuleSpecifier(specifier)) {
        specifiers.add(specifier)
      }
    }
  }

  return [...specifiers]
}

async function pathExists(filePath: string) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function resolveLocalModulePath(specifier: string, importerPath: string, projectRoot: string) {
  const basePath = specifier === '~'
    ? path.resolve(projectRoot, SOURCE_DIR)
    : specifier.startsWith('~/')
      ? path.resolve(projectRoot, SOURCE_DIR, specifier.slice(2))
      : path.resolve(path.dirname(importerPath), specifier)
  const candidates = path.extname(basePath)
    ? [basePath]
    : [
        ...SOURCE_FILE_EXTENSIONS.map((extension) => `${basePath}${extension}`),
        ...SOURCE_FILE_EXTENSIONS.map((extension) => path.join(basePath, `index${extension}`)),
      ]

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate
    }
  }

  return null
}

async function detectRouteHydrationFromFile(
  filePath: string,
  cache: Map<string, Promise<'client' | 'static'>>,
  projectRoot: string,
): Promise<'client' | 'static'> {
  const resolvedPath = path.resolve(filePath)
  const cached = cache.get(resolvedPath)

  if (cached) {
    return cached
  }

  const pending = (async () => {
    const source = await fs.readFile(resolvedPath, 'utf-8')

    if (detectRouteHydration(source) === 'client') {
      return 'client'
    }

    for (const specifier of extractLocalImportSpecifiers(source)) {
      const dependencyPath = await resolveLocalModulePath(specifier, resolvedPath, projectRoot)

      if (!dependencyPath) {
        continue
      }

      if (await detectRouteHydrationFromFile(dependencyPath, cache, projectRoot) === 'client') {
        return 'client'
      }
    }

    return 'static'
  })()

  cache.set(resolvedPath, pending)

  return pending
}

async function createGeneratedHydrationFile(routes: RouteInfo[], projectRoot: string) {
  const sortedRoutes = [...routes].sort((left, right) => {
    if (left.id === '__root__') return -1
    if (right.id === '__root__') return 1
    return left.id.localeCompare(right.id)
  })
  const hydrationCache = new Map<string, Promise<'client' | 'static'>>()

  const hydrationEntries = await Promise.all(sortedRoutes.map(async (route) => {
    const detected = await detectRouteHydrationFromFile(route.filePath, hydrationCache, projectRoot)

    return `  '${route.id}': { detected: '${detected}' }`
  }))

  return `/* eslint-disable */

// This file was automatically generated by VorzelaJs.
// Do not edit this file manually.

import type { GeneratedRouteHydrationRecord } from 'vorzelajs'

export const routeHydrationManifest = {
${hydrationEntries.join(',\n')}
} as const satisfies Readonly<Record<string, GeneratedRouteHydrationRecord>>
`
}

async function writeIfChanged(filePath: string, content: string) {
  const current = await fs.readFile(filePath, 'utf-8').catch(() => null)

  if (current !== content) {
    await fs.writeFile(filePath, content, 'utf-8')
  }
}

export async function generateRoutes(projectRoot = process.cwd()) {
  const routesDir = path.resolve(projectRoot, ROUTES_DIR)
  const outputPath = path.resolve(projectRoot, OUTPUT_FILE)
  const hydrationOutputPath = path.resolve(projectRoot, OUTPUT_HYDRATION_FILE)
  const routeFiles = (await walkFiles(routesDir))
    .filter((filePath) => ROUTE_FILE_PATTERN.test(filePath))
    .filter((filePath) => !isServerOnlyRouteFile(filePath))
    .filter((filePath) => !filePath.endsWith('.d.ts'))

  const routes = routeFiles.map((filePath) => getRouteInfo(filePath, routesDir))

  if (!routes.some((route) => route.id === '__root__')) {
    throw new Error(`Missing root route file at ${path.join(routesDir, '__root.tsx')}`)
  }

  const routesBySourcePath = new Map(routes.map((route) => [route.sourcePath, route] as const))
  const routesWithParents = routes.map((route) => ({
    ...route,
    parentId: findParentRouteId(route, routesBySourcePath),
  }))

  assertNoDuplicateMatchPaths(routesWithParents)

  await Promise.all([
    writeIfChanged(outputPath, createGeneratedFile(routesWithParents)),
    writeIfChanged(hydrationOutputPath, await createGeneratedHydrationFile(routesWithParents, projectRoot)),
  ])
}

export function vorzelaRoutesPlugin(): Plugin {
  let projectRoot = process.cwd()

  return {
    name: 'vorzelajs-routes',
    enforce: 'pre',
    configResolved(config) {
      projectRoot = config.root
    },
    async buildStart() {
      await generateRoutes(projectRoot)
    },
    configureServer(server) {
      const sourceRoot = path.resolve(projectRoot, 'src')
      const generatedRouteTreePath = path.resolve(projectRoot, OUTPUT_FILE)
      const generatedHydrationPath = path.resolve(projectRoot, OUTPUT_HYDRATION_FILE)

      const handleRouteChange = async (filePath: string) => {
        const absolutePath = path.resolve(filePath)

        if (
          absolutePath === generatedRouteTreePath
          || absolutePath === generatedHydrationPath
          || !absolutePath.startsWith(sourceRoot)
          || !ROUTE_FILE_PATTERN.test(absolutePath)
          || isServerOnlyRouteFile(absolutePath)
        ) {
          return
        }

        try {
          await generateRoutes(projectRoot)
          server.ws.send({ type: 'full-reload' })
        } catch (error) {
          server.config.logger.error(`[vorzelajs-routes] ${(error as Error).message}`)
        }
      }

      server.watcher.on('add', handleRouteChange)
      server.watcher.on('change', handleRouteChange)
      server.watcher.on('unlink', handleRouteChange)
    },
  }
}
