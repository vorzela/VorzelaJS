import { createFileRoute,Link } from '~/router'

const POSTS = [
  {
    slug: 'solid-streams',
    summary: 'Why streamed SSR matters for framework mode runtimes.',
    title: 'Streaming route output',
  },
  {
    slug: 'file-routing',
    summary: 'Generating a type-safe route tree from the filesystem.',
    title: 'Generated route trees',
  },
]

export const Route = createFileRoute('/posts')({
  head: () => ({
    meta: [
      {
        content: 'Example dynamic routes generated from the VorzelaJs file router.',
        name: 'description',
      },
    ],
    title: 'VorzelaJs | Posts',
  }),
  component: PostsIndexPage,
})

function PostsIndexPage() {
  return (
    <section class="page-card">
      <p class="eyebrow">Dynamic Routes</p>
      <h1>Generated route entries</h1>
      <div class="stack-list">
        {POSTS.map((post) => (
          <article class="stack-item">
            <h2>{post.title}</h2>
            <p>{post.summary}</p>
            <Link to={`/posts/${post.slug}`} class="text-link">Open route</Link>
          </article>
        ))}
      </div>
    </section>
  )
}