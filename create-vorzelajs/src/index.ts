#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import url from 'node:url'

import prompts from 'prompts'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Templates are bundled inside create-vorzelajs at package root
function resolveTemplatesDir() {
  return path.resolve(__dirname, '..', 'templates')
}

async function copyDir(src: string, dest: string) {
  await fs.mkdir(dest, { recursive: true })

  for (const entry of await fs.readdir(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name === 'gitignore' ? '.gitignore' : entry.name)

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath)
    } else {
      await fs.copyFile(srcPath, destPath)
    }
  }
}

async function pathExists(p: string) {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

interface ProjectConfig {
  name: string
  template: 'bare' | 'modern'
  styling: 'tailwindcss' | 'css-modules' | 'css'
}

function generatePackageJson(config: ProjectConfig) {
  const pkg: Record<string, unknown> = {
    name: config.name,
    private: true,
    type: 'module',
    scripts: {
      dev: 'vorzelajs dev',
      build: 'vorzelajs build',
      serve: 'NODE_ENV=production vorzelajs serve',
      check: 'tsc --noEmit',
    },
    dependencies: {
      vorzelajs: '^0.0.1',
      'solid-js': '^1.9',
    } as Record<string, string>,
    devDependencies: {
      typescript: '^6',
    } as Record<string, string>,
  }

  if (config.styling === 'tailwindcss') {
    (pkg.dependencies as Record<string, string>).tailwindcss = '^4.2'
    ;(pkg.dependencies as Record<string, string>)['@tailwindcss/vite'] = '^4.2'
  }

  return JSON.stringify(pkg, null, 2) + '\n'
}

async function main() {
  const argProjectName = process.argv[2]

  const response = await prompts(
    [
      {
        type: argProjectName ? null : 'text',
        name: 'name',
        message: 'Project name:',
        initial: 'my-app',
      },
      {
        type: 'select',
        name: 'template',
        message: 'Template:',
        choices: [
          { title: 'Modern', description: 'Multi-page starter with nav, features, and about page', value: 'modern' },
          { title: 'Bare', description: 'Single landing page with counter', value: 'bare' },
        ],
        initial: 0,
      },
      {
        type: 'select',
        name: 'styling',
        message: 'Styling:',
        choices: [
          { title: 'Tailwind CSS', description: 'Tailwind CSS v4 with utility classes', value: 'tailwindcss' },
          { title: 'CSS Modules', description: 'Scoped CSS modules', value: 'css-modules' },
          { title: 'Plain CSS', description: 'Global CSS with custom properties', value: 'css' },
        ],
        initial: 0,
      },
    ],
    {
      onCancel() {
        console.info('\nCancelled.')
        process.exit(0)
      },
    },
  )

  const config: ProjectConfig = {
    name: argProjectName ?? response.name ?? 'my-app',
    template: response.template ?? 'modern',
    styling: response.styling ?? 'tailwindcss',
  }

  const targetDir = path.resolve(process.cwd(), config.name)

  if (await pathExists(targetDir)) {
    const existing = await fs.readdir(targetDir)

    if (existing.length > 0) {
      console.error(`\nError: Directory "${config.name}" is not empty.`)
      process.exit(1)
    }
  }

  const templatesDir = resolveTemplatesDir()

  console.info(`\nScaffolding ${config.name}...`)

  // 1. Copy base template
  await copyDir(path.join(templatesDir, 'base'), targetDir)

  // 2. Copy chosen template
  await copyDir(path.join(templatesDir, config.template), targetDir)

  // 3. Apply styling variant
  const stylingDir = config.styling === 'tailwindcss' ? 'tailwind'
    : config.styling === 'css-modules' ? 'css-modules'
      : 'css'
  const stylesSource = path.join(templatesDir, 'styling', stylingDir, 'styles.css')
  const stylesDest = path.join(targetDir, 'src', 'styles.css')

  await fs.mkdir(path.dirname(stylesDest), { recursive: true })
  await fs.copyFile(stylesSource, stylesDest)

  // 4. Generate package.json
  await fs.writeFile(
    path.join(targetDir, 'package.json'),
    generatePackageJson(config),
  )

  console.info(`\nDone! Next steps:\n`)
  console.info(`  cd ${config.name}`)
  console.info(`  npm install`)
  console.info(`  npm run dev\n`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
