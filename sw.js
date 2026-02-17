/* sw.js — Service Worker / Offline System (Batch 1)
   - Cache-first for app shell
   - Network fallback for everything else
   - GitHub Pages subpath-safe via derived base path from registration scope
*/

const CACHE_VERSION = "v1.0.0";
const CACHE_NAME = `personal-os-${CACHE_VERSION}`;

function basePath() {
  // self.registration.scope ends with '/'
  // Example: https://user.github.io/personal-os/
  const u = new URL(self.registration.scope);
  return u.pathname; // "/personal-os/"
}

function withBase(p) {
  const b = basePath();
  // Ensure single slash join
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

  // Only handle GET
  if (req.method !== "GET") return;

  event.respondWith((async () => {
    const url = new URL(req.url);

    // Same-origin only
    if (url.origin !== self.location.origin) {
      return fetch(req).catch(() => caches.match(req));
    }

    // Cache-first for shell-like requests
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req, { ignoreSearch: true });

    // If request is for our app scope and matches shell patterns, return cached
    const inScope = url.pathname.startsWith(basePath());

    if (inScope) {
      // For navigations: serve cached index.html
      if (req.mode === "navigate") {
        const cachedIndex = await cache.match(withBase("index.html"), { ignoreSearch: true });
        if (cachedIndex) return cachedIndex;
      }

      if (cached) return cached;

      // Otherwise try network, then cache result
      try {
        const fresh = await fetch(req);
        // Cache only successful basic responses
        if (fresh && fresh.ok && fresh.type === "basic") {
          cache.put(req, fresh.clone());
        }
        return fresh;
      } catch (e) {
        // Fallback to index for navigations
        if (req.mode === "navigate") {
          const cachedIndex2 = await cache.match(withBase("index.html"), { ignoreSearch: true });
          if (cachedIndex2) return cachedIndex2;
        }
        // Last resort: return cached if any (even with search ignored)
        const any = await cache.match(req, { ignoreSearch: true });
        if (any) return any;
        throw e;
      }
    }

    // Outside scope: network-first
    try {
      return await fetch(req);
    } catch (e) {
      return cached || Response.error();
    }
  })());
});
