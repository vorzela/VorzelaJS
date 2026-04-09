import { createFileRoute } from 'vorzelajs'

export const Route = createFileRoute('/about')({
  component: AboutPage,
  head: () => ({
    title: 'About — VorzelaJs',
  }),
})

function AboutPage() {
  return (
    <main class="page">
      <div class="page-content">
        <h1>About VorzelaJs</h1>
        <p>
          VorzelaJs is a batteries-included SolidJS framework. Here's how your project is structured:
        </p>

        <section class="guide-section">
          <h2>Project Structure</h2>
          <pre class="code-block">{`src/
├── routes/         # File-based routes
│   ├── __root.tsx  # Root layout (wraps all pages)
│   ├── index.tsx   # Home page (/)
│   └── about.tsx   # This page (/about)
├── components/     # Reusable components
└── styles.css      # Global styles`}</pre>
        </section>

        <section class="guide-section">
          <h2>Routes</h2>
          <p>
            Each file in <code>src/routes/</code> becomes a route. Use <code>createFileRoute</code> to define
            loaders, head tags, and components. Files prefixed with <code>_</code> are pathless layout routes.
          </p>
        </section>

        <section class="guide-section">
          <h2>Server Boundaries</h2>
          <p>
            Name files with <code>.server.ts</code> to keep code server-only. Route <code>loader</code> and{' '}
            <code>beforeLoad</code> functions run exclusively on the server and are stripped from the client bundle.
          </p>
        </section>

        <section class="guide-section">
          <h2>Commands</h2>
          <pre class="code-block">{`npm run dev     # Start dev server
npm run build   # Build for production
npm run serve   # Serve production build`}</pre>
        </section>
      </div>
    </main>
  )
}
