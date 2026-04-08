import { createFileRoute, notFound } from '~/router'
import type { RouteComponentProps } from '~/router'

type PostLoaderData = {
  body: string
  title: string
}

const POST_CONTENT: Record<string, PostLoaderData> = {
  'solid-streams': {
    body: 'Streamed SSR lets the framework send shell HTML immediately while route content resolves progressively.',
    title: 'Streaming route output',
  },
  'file-routing': {
    body: 'The generated routeTree.gen.ts file is the bridge between the route filesystem and the router runtime.',
    title: 'Generated route trees',
  },
}

export const Route = createFileRoute('/posts/$postId')<PostLoaderData>({
  beforeLoad: ({ params }) => {
    if (!POST_CONTENT[params.postId]) {
      throw notFound({ message: `Post ${params.postId} was not found.` })
    }
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        content: loaderData.body,
        name: 'description',
      },
    ],
    title: `VorzelaJs | ${loaderData.title}`,
  }),
  loader: async ({ params }) => {
    return POST_CONTENT[params.postId]
  },
  component: PostDetailPage,
})

function PostDetailPage(
  props: RouteComponentProps<'/posts/$postId', PostLoaderData>,
) {
  return (
    <section class="page-card">
      <p class="eyebrow">Dynamic Segment</p>
      <h1>{props.loaderData.title}</h1>
      <p class="lead-copy">{props.loaderData.body}</p>
      <p class="mono-note">postId: {props.params.postId}</p>
    </section>
  )
}