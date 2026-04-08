import { For } from 'solid-js'
import { HydrationScript } from 'solid-js/web'

import type { BootstrapPayload, HeadObject, RenderAssets } from './router'
import type { JSX } from 'solid-js'

interface DocumentProps {
  assets: RenderAssets
  bootstrap: BootstrapPayload
  children: JSX.Element
  head: HeadObject
}

function serializeBootstrapPayload(payload: BootstrapPayload) {
  return JSON.stringify(payload)
    .replace(/</gu, '\\u003c')
    .replace(/>/gu, '\\u003e')
}

export function Document(props: DocumentProps) {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{props.head.title ?? 'VorzelaJs'}</title>
        <For each={props.head.meta ?? []}>
          {(meta) => <meta {...meta} data-vrz-head="" />}
        </For>
        <For each={props.head.links ?? []}>
          {(link) => <link {...link} data-vrz-head="" />}
        </For>
        <HydrationScript />
        <For each={props.assets.css}>
          {(href) => <link rel="stylesheet" href={href} />}
        </For>
      </head>
      <body>
        <div id="app">{props.children}</div>
        <script id="__VORZELA_DATA__" type="application/json">
          {serializeBootstrapPayload(props.bootstrap)}
        </script>
        <For each={props.assets.js}>
          {(src) => <script type="module" src={src} />}
        </For>
      </body>
    </html>
  )
}