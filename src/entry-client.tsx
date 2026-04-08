import { hydrate } from 'solid-js/web'

import {
	RouterProvider,
	createRouter,
	readBootstrapPayload,
} from './router'
import './styles.css'

async function start() {
	const router = createRouter(readBootstrapPayload())
	await router.init()

	hydrate(() => <RouterProvider router={router} />, document.getElementById('app')!)
}

void start()