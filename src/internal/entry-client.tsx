// @ts-expect-error resolved by vorzelajs vite plugin
import 'virtual:vorzela/styles'

import { createRouter, readBootstrapPayload } from '../runtime/index.jsx'

async function start() {
  const router = createRouter(readBootstrapPayload())
  await router.init()
}

void start()
