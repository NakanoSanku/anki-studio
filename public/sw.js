const CACHE_NAME = "anki-studio-shell-v6"
const STATIC_PATHS = ["/manifest.webmanifest", "/icon.svg", "/icon-maskable.svg"]

function isCacheableAsset(url, request) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    ["font", "image", "script", "style"].includes(request.destination)
  )
}

async function cacheResponse(cache, request, response) {
  if (response.ok && response.type === "basic") {
    await cache.put(request, response.clone())
  }
  return response
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME)
      await Promise.allSettled(STATIC_PATHS.map((path) => cache.add(path)))

      await self.skipWaiting()
    })()
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)))
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable()
      }
      await self.clients.claim()
    })()
  )
})

self.addEventListener("message", (event) => {
  if (event.data?.type !== "CACHE_URLS" || !Array.isArray(event.data.urls)) return
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME)
      const paths = event.data.urls.filter((path) => {
        if (typeof path !== "string") return false
        const url = new URL(path, self.location.origin)
        return url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")
      })
      await Promise.allSettled([...new Set(paths)].map((path) => cache.add(path)))
    })()
  )
})

self.addEventListener("fetch", (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    url.pathname === "/sw.js"
  ) {
    return
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return (await event.preloadResponse) || await fetch(request)
        } catch {
          // Never serve an HTML shell without a fresh authentication check.
          return Response.error()
        }
      })()
    )
    return
  }

  if (isCacheableAsset(url, request)) {
    event.respondWith(
      caches.match(request).then(async (cached) => {
        if (cached) return cached
        const response = await fetch(request)
        const cache = await caches.open(CACHE_NAME)
        return cacheResponse(cache, request, response)
      })
    )
  }
})
