import { createFileRoute } from 'vorzelajs'
import { CounterCard } from '../components/counter-card'

export const Route = createFileRoute('/')({
  component: HomePage,
  head: () => ({
    title: 'VorzelaJs',
  }),
})

function HomePage() {
  return (
    <main class="hero">
      <div class="hero-content">
        <h1 class="hero-title">VorzelaJs</h1>
        <p class="hero-description">
          A batteries-included SolidJS framework with file-based routing, streamed SSR, and server-only boundaries.
        </p>

        <CounterCard />

        <div class="features">
          <div class="feature-card">
            <h3>File-Based Routing</h3>
            <p>Drop a file in <code>src/routes/</code> and it becomes a route. Automatic code splitting included.</p>
          </div>
          <div class="feature-card">
            <h3>Streamed SSR</h3>
            <p>Server-rendered HTML streams to the browser with selective hydration per route.</p>
          </div>
          <div class="feature-card">
            <h3>Server Boundaries</h3>
            <p>Use <code>.server</code> files and route loaders to keep secrets on the server.</p>
          </div>
        </div>

        <nav class="hero-links">
          <a href="https://github.com/vorzela/VorzelaJS" target="_blank" rel="noopener noreferrer" class="link">
            GitHub
          </a>
          <a href="https://github.com/vorzela/VorzelaJS#readme" target="_blank" rel="noopener noreferrer" class="link">
            Documentation
          </a>
          <a href="https://www.npmjs.com/package/vorzelajs" target="_blank" rel="noopener noreferrer" class="link">
            npm
          </a>
        </nav>
      </div>
    </main>
  )
}
