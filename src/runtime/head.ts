import type { HeadObject, LinkDescriptor, MetaDescriptor } from './types'

const MANAGED_HEAD_SELECTOR = '[data-vrz-head]'

function applyMetaAttributes(element: HTMLMetaElement, meta: MetaDescriptor) {
  if (meta.charset) element.setAttribute('charset', meta.charset)
  if (meta.content) element.setAttribute('content', meta.content)
  if (meta.httpEquiv) element.setAttribute('http-equiv', meta.httpEquiv)
  if (meta.name) element.setAttribute('name', meta.name)
  if (meta.property) element.setAttribute('property', meta.property)
}

function applyLinkAttributes(element: HTMLLinkElement, link: LinkDescriptor) {
  element.setAttribute('href', link.href)
  element.setAttribute('rel', link.rel)

  if (link.as) element.setAttribute('as', link.as)
  if (link.crossorigin) element.setAttribute('crossorigin', link.crossorigin)
  if (link.type) element.setAttribute('type', link.type)
}

function metaKey(meta: MetaDescriptor, index: number) {
  if (meta.charset) return 'charset'
  if (meta.name) return `name:${meta.name}`
  if (meta.property) return `property:${meta.property}`
  if (meta.httpEquiv) return `http-equiv:${meta.httpEquiv}`
  return `meta:${index}`
}

function linkKey(link: LinkDescriptor, index: number) {
  return `${link.rel}:${link.href}:${link.as ?? ''}:${index}`
}

export function mergeHeads(heads: Array<HeadObject | undefined>) {
  const metaEntries = new Map<string, MetaDescriptor>()
  const linkEntries = new Map<string, LinkDescriptor>()
  let title: string | undefined
  let canonical: string | undefined
  const jsonLdItems: Record<string, unknown>[] = []

  heads.forEach((head) => {
    if (!head) return

    if (head.title) {
      title = head.title
    }

    if (head.canonical) {
      canonical = head.canonical
    }

    if (head.jsonLd) {
      if (Array.isArray(head.jsonLd)) {
        jsonLdItems.push(...head.jsonLd)
      } else {
        jsonLdItems.push(head.jsonLd)
      }
    }

    head.meta?.forEach((meta, index) => {
      metaEntries.set(metaKey(meta, index), meta)
    })

    head.links?.forEach((link, index) => {
      linkEntries.set(linkKey(link, index), link)
    })
  })

  return {
    canonical,
    jsonLd: jsonLdItems.length > 0 ? jsonLdItems : undefined,
    title,
    meta: [...metaEntries.values()],
    links: [...linkEntries.values()],
  } satisfies HeadObject
}

export function syncHead(head: HeadObject) {
  if (typeof document === 'undefined') return

  document.title = head.title ?? 'VorzelaJs'
  document.head.querySelectorAll(MANAGED_HEAD_SELECTOR).forEach((element) => element.remove())

  head.meta?.forEach((meta) => {
    const element = document.createElement('meta')
    element.setAttribute('data-vrz-head', '')

    applyMetaAttributes(element, meta)

    document.head.appendChild(element)
  })

  head.links?.forEach((link) => {
    const element = document.createElement('link')
    element.setAttribute('data-vrz-head', '')

    applyLinkAttributes(element, link)

    document.head.appendChild(element)
  })

  if (head.canonical) {
    const link = document.createElement('link')
    link.setAttribute('rel', 'canonical')
    link.setAttribute('href', head.canonical)
    link.setAttribute('data-vrz-head', '')
    document.head.appendChild(link)
  }

  document.head.querySelectorAll('script[data-vrz-jsonld]').forEach((el) => el.remove())

  if (head.jsonLd) {
    const items = Array.isArray(head.jsonLd) ? head.jsonLd : [head.jsonLd]

    for (const item of items) {
      const script = document.createElement('script')
      script.setAttribute('type', 'application/ld+json')
      script.setAttribute('data-vrz-jsonld', '')
      script.textContent = JSON.stringify(item)
      document.head.appendChild(script)
    }
  }
}