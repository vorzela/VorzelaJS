import type { JSX } from 'solid-js'
import { For } from 'solid-js'
import { HydrationScript } from 'solid-js/web'

import type { BootstrapPayload, HeadObject, RenderAssets } from './router/index.js'

interface DocumentProps {
  assets: RenderAssets
  bootstrap: BootstrapPayload
  children: JSX.Element
  head: HeadObject
  nonce?: string
}

const NoncedHydrationScript = HydrationScript as unknown as (props: { nonce?: string }) => JSX.Element

function serializeBootstrapPayload(payload: BootstrapPayload) {
  return JSON.stringify(payload)
    .replace(/&/gu, '\u0026')
    .replace(/</gu, '\\u003c')
    .replace(/>/gu, '\\u003e')
    .replace(/\u2028/gu, '\\u2028')
    .replace(/\u2029/gu, '\\u2029')
}

function serializeJsonLd(data: Record<string, unknown>) {
  return JSON.stringify(data)
    .replace(/&/gu, '\u0026')
    .replace(/</gu, '\\u003c')
    .replace(/>/gu, '\\u003e')
}

export function Document(props: DocumentProps) {
  const jsonLdItems = () => {
    if (!props.head.jsonLd) return []
    return Array.isArray(props.head.jsonLd) ? props.head.jsonLd : [props.head.jsonLd]
  }

  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{props.head.title ?? 'VorzelaJs'}</title>
        <For each={props.head.meta ?? []}>
          {(meta) => (
            <meta
              charset={meta.charset}
              content={meta.content}
              http-equiv={meta.httpEquiv as JSX.MetaHTMLAttributes<HTMLMetaElement>['http-equiv']}
              name={meta.name}
              property={meta.property}
              data-vrz-head=""
            />
          )}
        </For>
        <For each={props.head.links ?? []}>
          {(link) => (
            <link
              as={link.as}
              crossorigin={link.crossorigin}
              href={link.href}
              hreflang={link.hreflang}
              media={link.media}
              rel={link.rel}
              sizes={link.sizes}
              type={link.type}
              data-vrz-head=""
            />
          )}
        </For>
        {props.head.canonical && (
          <link rel="canonical" href={props.head.canonical} data-vrz-head="" />
        )}
        <For each={jsonLdItems()}>
          {(item) => (
            <script type="application/ld+json" data-vrz-jsonld="" nonce={props.nonce}>
              {serializeJsonLd(item)}
            </script>
          )}
        </For>
        <NoncedHydrationScript nonce={props.nonce} />
        <For each={props.assets.css}>
          {(href) => <link rel="stylesheet" href={href} />}
        </For>
      </head>
      <body>
        <div id="app">{props.children}</div>
        <script id="__VORZELA_DATA__" nonce={props.nonce} type="application/json">
          {serializeBootstrapPayload(props.bootstrap)}
        </script>
        <For each={props.assets.js}>
          {(src) => <script nonce={props.nonce} type="module" src={src} />}
        </For>
      </body>
    </html>
  )
}