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

        <div class="features">
          <div class="feature-card">
            <h3>🚀 Production-Ready</h3>
            <p>Navigation resilience, persistent state, and security headers built-in. Ready for real-world apps.</p>
          </div>
          <div class="feature-card">
            <h3>⚡ Fast by Default</h3>
            <p>Prefetch on hover, View Transitions API, and optimized bundles for instant navigation.</p>
          </div>
          <div class="feature-card">
            <h3>🔒 Secure</h3>
            <p>Configurable CSP, nonce-based scripts, XSS protection, and comprehensive security headers.</p>
          </div>
        </div>

        <nav class="hero-links">
          <a href="https://github.com/vorzela/VorzelaJS" target="_blank" rel="noopener noreferrer" class="link">
            GitHub
          </a>
          <a href="https://github.com/vorzela/VorzelaJS/blob/main/docs/production-features.md" target="_blank" rel="noopener noreferrer" class="link">
            Production Features
          </a>
          <a href="https://www.npmjs.com/package/vorzelajs" target="_blank" rel="noopener noreferrer" class="link">
            npm
          </a>
        </nav>
      </div>
    </main>
  )
}
