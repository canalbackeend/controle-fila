const CACHE = "beend-fila-static-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        const document = await fetch("/", { cache: "reload" });
        if (!document.ok) return;
        const html = await document.clone().text();
        await cache.put("/", document);
        const assets = [
          ...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g),
        ].map((match) => match[1]);
        await Promise.allSettled(assets.map((asset) => cache.add(asset)));
      } finally {
        await self.skipWaiting();
      }
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter(
            (name) => name.startsWith("beend-fila-static-") && name !== CACHE,
          )
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

async function cacheResponse(cache, key, response) {
  if (!response.ok) return;
  await cache.put(key, response.clone());
  const keys = await cache.keys();
  const images = keys.filter((item) =>
    new URL(item.url).pathname.startsWith("/api/assets/"),
  );
  const scripts = keys.filter((item) =>
    new URL(item.url).pathname.startsWith("/assets/"),
  );
  await Promise.all(
    [
      ...images.slice(0, Math.max(0, images.length - 96)),
      ...scripts.slice(0, Math.max(0, scripts.length - 32)),
    ].map((item) => cache.delete(item)),
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (request.mode === "navigate" && !url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(
        async () => (await caches.match("/")) || Response.error(),
      ),
    );
  } else if (
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/api/assets/")
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        await cacheResponse(cache, request, response).catch(() => {});
        return response;
      })(),
    );
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "CACHE_IMAGES" || !Array.isArray(event.data.paths))
    return;
  const paths = [...new Set(event.data.paths)]
    .filter(
      (path) =>
        typeof path === "string" &&
        /^\/api\/assets\/[a-f0-9]{64}\.(?:webp|png)$/.test(path),
    )
    .slice(0, 48);
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      for (const path of paths) {
        if (await cache.match(path)) continue;
        try {
          await cacheResponse(cache, path, await fetch(path));
        } catch {
          /* Existing cached assets remain usable. */
        }
      }
    })(),
  );
});
