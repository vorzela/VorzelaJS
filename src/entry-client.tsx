import './styles.css'

import { createRouter, readBootstrapPayload } from './router'

async function start() {
	const router = createRouter(readBootstrapPayload())
	await router.init()
}

void start()