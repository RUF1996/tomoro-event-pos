/* TOMORO EVENT POS service worker
 * Online: use fresh page responses and refresh the cache.
 * Offline: fall back to the last cached page/assets.
 */
const CACHE_NAME = "tomoro-event-pos-v2";
const CACHE_PREFIX = "tomoro-event-pos-";
const APP_SHELL = "./";

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // A failed pre-cache should not prevent the worker from installing.
    await cache.add(APP_SHELL).catch(() => {});
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    // Always try the live site first so published changes appear online.
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request, { cache: "no-store" });
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch (error) {
        return (await cache.match(request)) ||
          (await cache.match(APP_SHELL)) ||
          Response.error();
      }
    })());
    return;
  }

  // For same-origin files, respond quickly from cache and refresh it in the background.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    const update = fetch(request).then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    });
    if (cached) {
      event.waitUntil(update.catch(() => {}));
      return cached;
    }
    try {
      return await update;
    } catch (error) {
      return Response.error();
    }
  })());
});
