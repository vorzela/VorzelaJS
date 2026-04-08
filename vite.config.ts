import path from 'node:path'
import url from 'node:url'

import { defineConfig } from 'vite'
import solidPlugin from 'vite-plugin-solid'

import { vorzelaRoutesPlugin } from './scripts/generate-routes'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig(({ isSsrBuild }) => ({
  resolve: {
    alias: {
      '~': path.resolve(__dirname, 'src'),
    },
  },
  plugins: [
    vorzelaRoutesPlugin(),
    solidPlugin({ ssr: true }),
  ],
  build: isSsrBuild
    ? {
        outDir: 'dist/server',
        emptyOutDir: false,
        copyPublicDir: false,
        rollupOptions: {
          output: {
            entryFileNames: 'entry-server.js',
            chunkFileNames: 'chunks/[name]-[hash].js',
            assetFileNames: 'assets/[name]-[hash][extname]',
          },
        },
      }
    : {
        outDir: 'dist/client',
        emptyOutDir: true,
        copyPublicDir: true,
        manifest: true,
        rollupOptions: {
          input: path.resolve(__dirname, 'src/entry-client.tsx'),
          output: {
            entryFileNames: 'assets/[name]-[hash].js',
            chunkFileNames: 'assets/[name]-[hash].js',
            assetFileNames: 'assets/[name]-[hash][extname]',
          },
        },
      },
}))