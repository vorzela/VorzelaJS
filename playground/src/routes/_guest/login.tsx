import { createFileRoute, Link, resolveRedirectTarget } from '~/router'

export const Route = createFileRoute('/_guest/login')({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  head: () => ({
    meta: [
      {
        content: 'Guest route rendered through an underscore pathless layout route.',
        name: 'description',
      },
    ],
    title: 'VorzelaJs | Login',
  }),
  component: LoginPage,
})

function LoginPage() {
  const search = Route.useSearch()
  const redirectTarget = () => resolveRedirectTarget(search().redirect, {
    defaultTo: '/about',
    disallowedPrefixes: ['/login'],
  })

  return (
    <div class="stack-list">
      <article class="stack-item">
        <h2>Underscore pathless route</h2>
        <p>This page lives at `_guest/login.tsx`, but the URL is `/login`.</p>
      </article>

      <article class="stack-item">
        <h2>Validated redirect target</h2>
        <p>
          `validateSearch` sanitizes the incoming `redirect` query param, and `Route.useSearch()`
          returns the typed result inside the route component.
        </p>
        <p class="mono-note">next: {redirectTarget()}</p>
        <Link to={redirectTarget()} class="button button--primary">
          Simulate login redirect
        </Link>
      </article>
    </div>
  )
}