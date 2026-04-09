const CACHE_PREFIX = 'vorzela-'

export function generateServiceWorker(precacheUrls: string[]): string {
  const cacheVersion = generateCacheVersion(precacheUrls)
  const assetCacheName = `${CACHE_PREFIX}assets-${cacheVersion}`
  const runtimeCacheName = `${CACHE_PREFIX}runtime-${cacheVersion}`

  return `// VorzelaJS Service Worker — auto-generated, do not edit
const ASSET_CACHE = ${JSON.stringify(assetCacheName)};
const RUNTIME_CACHE = ${JSON.stringify(runtimeCacheName)};
const PRECACHE_URLS = ${JSON.stringify(precacheUrls, null, 2)};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(ASSET_CACHE).then((cache) => cache.addAll([...PRECACHE_URLS, '/offline.html']))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith(${JSON.stringify(CACHE_PREFIX)}) && key !== ASSET_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET and cross-origin
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Cache-first for hashed assets
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
        const clone = response.clone();
        caches.open(ASSET_CACHE).then((cache) => cache.put(event.request, clone));
        return response;
      }))
    );
    return;
  }

  // Network-first for navigation requests
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/offline.html')))
    );
    return;
  }

  // Network-first for everything else
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
`
}

function generateCacheVersion(urls: string[]): string {
  // Simple hash of the sorted URLs list for cache versioning
  let hash = 0
  const str = urls.slice().sort().join('|')
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash + char) | 0
  }
  return Math.abs(hash).toString(36)
}
