import { Outlet, createFileRoute } from '~/router'

export const Route = createFileRoute('/_guest')({
  component: GuestLayout,
})

function GuestLayout() {
  return (
    <section class="page-card">
      <p class="eyebrow">Pathless Group</p>
      <h1>Guest layout</h1>
      <p class="lead-copy">
        This layout route comes from `_guest.tsx`, but the underscore segment is ignored in the URL.
      </p>
      <Outlet />
    </section>
  )
}