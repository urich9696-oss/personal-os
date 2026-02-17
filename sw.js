/* sw.js — Service Worker / Offline System (Batch 3)
   Cache version bump: v1.0.2
*/

const CACHE_VERSION = "v1.0.2";
const CACHE_NAME = `personal-os-${CACHE_VERSION}`;

function basePath() {
  const u = new URL(self.registration.scope);
  return u.pathname;
}

function withBase(p) {
  const b = basePath();
  if (p.startsWith("/")) p = p.slice(1);
  return b + p;
}

const SHELL = [
  "index.html",
  "style.css",
  "app.js",
  "db.js",
  "manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const reqs = SHELL.map((p) => new Request(withBase(p), { cache: "reload" }));
    await cache.addAll(reqs);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k === CACHE_NAME ? Promise.resolve() : caches.delete(k))));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  event.respondWith((async () => {
    const url = new URL(req.url);

    if (url.origin !== self.location.origin) {
      return fetch(req).catch(() => caches.match(req));
    }

    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req, { ignoreSearch: true });

    const inScope = url.pathname.startsWith(basePath());

    if (inScope) {
      if (req.mode === "navigate") {
        const cachedIndex = await cache.match(withBase("index.html"), { ignoreSearch: true });
        if (cachedIndex) return cachedIndex;
      }

      if (cached) return cached;

      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok && fresh.type === "basic") cache.put(req, fresh.clone());
        return fresh;
      } catch (e) {
        if (req.mode === "navigate") {
          const cachedIndex2 = await cache.match(withBase("index.html"), { ignoreSearch: true });
          if (cachedIndex2) return cachedIndex2;
        }
        const any = await cache.match(req, { ignoreSearch: true });
        if (any) return any;
        throw e;
      }
    }

    try {
      return await fetch(req);
    } catch (e) {
      return cached || Response.error();
    }
  })());
});
