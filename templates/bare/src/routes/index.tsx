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
          Production-ready SolidJS framework with file-based routing, streamed SSR, and navigation resilience.
        </p>

        <CounterCard />

        <div class="features-list">
          <div class="feature-item">✅ Navigation race condition prevention</div>
          <div class="feature-item">✅ Persistent client state across navigations</div>
          <div class="feature-item">✅ Security headers and CSP configuration</div>
          <div class="feature-item">✅ Prefetch on hover for instant navigation</div>
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
