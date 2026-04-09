// @ts-expect-error resolved by vorzelajs vite plugin
import 'virtual:vorzela/styles'

import { createRouter, readBootstrapPayload } from '../runtime/index.jsx'

async function start() {
  const router = createRouter(readBootstrapPayload())
  await router.init()

  // Register service worker in production (when sw.js exists)
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && !import.meta.env.DEV) {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // SW registration failed silently — likely no sw.js present (PWA not enabled)
    })
  }
}

void start()
