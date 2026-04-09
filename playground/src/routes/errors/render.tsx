import { createFileRoute } from '~/router'

export const Route = createFileRoute('/errors/render')({
  head: () => ({
    meta: [
      {
        content: 'Demonstrates automatic route-scoped render error handling.',
        name: 'description',
      },
    ],
    title: 'VorzelaJs | Render Error Demo',
  }),
  component: RenderErrorPage,
})

function RenderErrorPage(): never {
  throw new Error('This render error is isolated to the route slot instead of breaking the whole app shell.')
}