import path from 'node:path'

import { resolveVorzelaConfig, resolveVorzelalBuildConfig, vorzelaServerOnlyPlugin } from '../vite'
import { generateRoutes } from '../vite/routes-plugin'

export async function runBuild() {
  const appRoot = process.cwd()

  console.info('[VorzelaJs] Generating routes...')
  await generateRoutes(appRoot)

  const { build, mergeConfig } = await import('vite')
  const baseConfig = await resolveVorzelaConfig(appRoot)

  // Client build (includes server-only stripping)
  console.info('[VorzelaJs] Building client...')
  const clientBuildConfig = resolveVorzelalBuildConfig(appRoot, 'client')
  const clientPlugins = [vorzelaServerOnlyPlugin()]

  await build(mergeConfig(baseConfig, {
    ...clientBuildConfig,
    plugins: clientPlugins,
  }))

  // Server build
  console.info('[VorzelaJs] Building server...')
  const serverBuildConfig = resolveVorzelalBuildConfig(appRoot, 'server')

  await build(mergeConfig(baseConfig, serverBuildConfig))

  console.info('[VorzelaJs] Build complete.')
}
