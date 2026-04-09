# SEO Guide

This guide documents the current head, robots, and sitemap support in VorzelaJs.

## Route Head Fields

`head()` can currently return:

- `title`
- `meta`
- `links`
- `canonical`
- `jsonLd`

`links` currently supports:

- `rel`
- `href`
- `as`
- `crossorigin`
- `hreflang`
- `media`
- `sizes`
- `type`

Example:

```tsx
import { createFileRoute } from '~/router'

export const Route = createFileRoute('/posts/$postId')<{ title: string }>({
  head: ({ loaderData, pathname }) => ({
    title: loaderData.title,
    canonical: `https://example.com${pathname}`,
    meta: [
      {
        content: loaderData.title,
        name: 'description',
      },
    ],
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: loaderData.title,
    },
  }),
  loader: async () => ({ title: 'Post title' }),
  component: PostPage,
})
```

Current behavior:

- canonical links render on the initial SSR response and are updated on client navigation
- JSON-LD renders as `application/ld+json` scripts
- production document responses apply the CSP nonce to JSON-LD scripts
- managed head tags are replaced on navigation through the runtime head synchronizer

When multiple routes contribute head objects, the runtime merges them from parent to child. The latest `title` and `canonical` win, while meta and link entries are keyed and deduplicated.

## Robots Helpers

Import robots helpers from `~/router/server`.

Example `src/entry-server.tsx` export:

```tsx
import { defaultRobotsConfig, defineRobotsConfig } from '~/router/server'

export const robotsConfig = defineRobotsConfig({
  ...defaultRobotsConfig({ siteUrl: 'https://app.example.com' }),
  rules: [
    {
      userAgent: '*',
      allow: ['/'],
    },
    {
      userAgent: ['GPTBot', 'ClaudeBot', 'Google-Extended'],
      disallow: ['/'],
    },
  ],
})
```

`defaultRobotsConfig()` currently:

- allows normal crawlers
- blocks known AI training crawlers
- allows selected AI search crawlers with a crawl delay
- can advertise `sitemap.xml` when a site URL is provided

If you need lower-level control, `renderRobotsTxt(config)` returns the plain-text robots body directly.

## Sitemap Generation

The built-in runtime serves `GET /sitemap.xml`.

Current behavior:

- if `src/entry-server.tsx` exports `getSitemapEntries()`, the runtime uses it
- the current default `src/entry-server.tsx` export builds entries from generated non-dynamic routes and skips `$` params
- sitemap XML is escaped by the runtime before sending it to the client

Example custom sitemap export:

```tsx
import type { SitemapEntry } from '~/router'

export async function getSitemapEntries(): Promise<SitemapEntry[]> {
  return [
    { loc: '/' },
    { changefreq: 'weekly', loc: '/posts/hello-world', priority: 0.8 },
  ]
}
```

Use this when you want to include CMS-backed or otherwise dynamic routes that do not appear automatically in the generated static route manifest.

## Runtime Defaults

The server runtime currently adds these crawl-related defaults:

- dynamic `GET /robots.txt`
- dynamic `GET /sitemap.xml`
- `X-Robots-Tag: index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1`

If you need crawler-specific policy beyond those defaults, export `robotsConfig` from `src/entry-server.tsx`.