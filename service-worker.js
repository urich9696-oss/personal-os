/* Personal OS Service Worker (GH-Pages subpath safe)
   - Cache version bump: change CACHE_VERSION
   - install: skipWaiting + precache
   - activate: clients.claim + cleanup
   - fetch: cache-first for same-origin GET assets
            navigation fallback to cached index.html
*/
const CACHE_VERSION = "v1.0.0";
const CACHE_NAME = `personal-os-cache-${CACHE_VERSION}`;

/**
 * IMPORTANT: URLs are relative to the SW scope.
 * We compute absolute URLs using registration.scope so it works under /REPO/.
 */
const ASSETS = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./manifest.webmanifest",

  "./js/core/state.js",
  "./js/core/ui.js",
  "./js/core/registry.js",
  "./js/core/router.js",
  "./js/core/boot.js",

  "./js/screens/dashboard.js",
  "./js/screens/mindset.js",
  "./js/screens/path.js",
  "./js/screens/maintenance.js",
  "./js/screens/finance.js",

  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png"
];

function toScopeUrl(relativePath) {
  const scope = self.registration.scope; // e.g. https://user.github.io/repo/
  return new URL(relativePath, scope).toString();
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const urls = ASSETS.map(toScopeUrl);
    await cache.addAll(urls);
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle GET
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // Navigation: serve cached index.html if offline (or cache-first)
  const isNav = req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");
  if (isNav && sameOrigin) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(toScopeUrl("./index.html"));
      try {
        const fresh = await fetch(req);
        // Best-effort update cache
        cache.put(req, fresh.clone()).catch(() => {});
        return fresh;
      } catch (_) {
        return cached || new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
      }
    })());
    return;
  }

  // Assets: cache-first for same-origin
  if (sameOrigin) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req, { ignoreSearch: true });
      if (cached) return cached;

      try {
        const res = await fetch(req);
        // Only cache successful basic/cors
        if (res && (res.type === "basic" || res.type === "cors") && res.status === 200) {
          cache.put(req, res.clone()).catch(() => {});
        }
        return res;
      } catch (_) {
        return new Response("", { status: 504 });
      }
    })());
  }
});
