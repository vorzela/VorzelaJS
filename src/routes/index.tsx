import { Link, createFileRoute, withRedirectParam } from '~/router'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      {
        content: 'Home page for the VorzelaJs framework proof-of-concept.',
        name: 'description',
      },
    ],
    title: 'VorzelaJs | Home',
  }),
  component: HomePage,
})

function HomePage() {
  return (
    <section class="page-card page-card--hero">
      <p class="eyebrow">Framework Mode</p>
      <h1>Hello world</h1>
      <p class="lead-copy">
        VorzelaJs now renders the first document on the server, hydrates on the client,
        and navigates between file-based routes without a full reload.
      </p>

      <div class="hero-actions">
        <Link to="/about" class="button button--primary">Client route</Link>
        <Link to="/filters" class="button button--primary">Filter search demo</Link>
        <Link to="/posts" class="button button--secondary">Dynamic routes</Link>
        <Link to="/server-payload" class="button button--ghost">Hybrid server payload</Link>
        <Link to="/login" class="button button--secondary">Pathless guest route</Link>
        <Link to={withRedirectParam('/login', '/server-payload')} class="button button--secondary">
          Login with redirect
        </Link>
        <Link to="/errors/render" class="button button--ghost">Render error demo</Link>
        <Link to="/errors/loader" class="button button--ghost">Loader error demo</Link>
      </div>
    </section>
  )
}