/**
 * Clear all VorzelaJS PWA caches.
 * Call this when you want to force-refresh all cached content.
 */
export async function clearCache(): Promise<void> {
  if (typeof caches === 'undefined') return

  const keys = await caches.keys()
  await Promise.all(
    keys.filter((key) => key.startsWith('vorzela-')).map((key) => caches.delete(key)),
  )
}

/** Check if the browser is currently offline */
export function isOffline(): boolean {
  return typeof navigator !== 'undefined' ? !navigator.onLine : false
}

/** Register a callback for when the browser goes offline */
export function onOffline(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {}

  window.addEventListener('offline', callback)
  return () => window.removeEventListener('offline', callback)
}

/** Register a callback for when the browser comes back online */
export function onOnline(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {}

  window.addEventListener('online', callback)
  return () => window.removeEventListener('online', callback)
}
