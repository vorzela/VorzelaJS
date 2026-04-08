import type { HeadObject, LinkDescriptor, MetaDescriptor } from './types'

const MANAGED_HEAD_SELECTOR = '[data-vrz-head]'

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

function setAttribute(element: Element, key: string, value: string) {
  if (key === 'httpEquiv') {
    element.setAttribute('http-equiv', value)
    return
  }

  element.setAttribute(key, value)
}

export function mergeHeads(heads: Array<HeadObject | undefined>) {
  const metaEntries = new Map<string, MetaDescriptor>()
  const linkEntries = new Map<string, LinkDescriptor>()
  let title: string | undefined

  heads.forEach((head) => {
    if (!head) return

    if (head.title) {
      title = head.title
    }

    head.meta?.forEach((meta, index) => {
      metaEntries.set(metaKey(meta, index), meta)
    })

    head.links?.forEach((link, index) => {
      linkEntries.set(linkKey(link, index), link)
    })
  })

  return {
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

    Object.entries(meta).forEach(([key, value]) => {
      if (value !== undefined) {
        setAttribute(element, key, value)
      }
    })

    document.head.appendChild(element)
  })

  head.links?.forEach((link) => {
    const element = document.createElement('link')
    element.setAttribute('data-vrz-head', '')

    Object.entries(link).forEach(([key, value]) => {
      if (value !== undefined) {
        setAttribute(element, key, value)
      }
    })

    document.head.appendChild(element)
  })
}