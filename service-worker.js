// service-worker.js
/* PERSONAL OS — Service Worker (GitHub Pages subpath-safe)
   - Cache-first app shell
   - Navigation requests fall back to cached ./ or index.html
   - Version bump controls updates
*/

const CACHE_VERSION = "0.1.3";
const CACHE_NAME = `personal-os-${CACHE_VERSION}`;

function sameOrigin(url) {
  try { return new URL(url).origin === self.location.origin; } catch (e) { return false; }
}

function isNavigationRequest(request) {
  return request.mode === "navigate";
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    self.skipWaiting();

    const ASSETS = [
      "./",
      "./index.html",
      "./index.html?v=" + CACHE_VERSION,

      "./manifest.webmanifest?v=" + CACHE_VERSION,
      "./css/styles.css?v=" + CACHE_VERSION,

      "./js/core/ui.js?v=" + CACHE_VERSION,
      "./js/core/db.js?v=" + CACHE_VERSION,
      "./js/core/state.js?v=" + CACHE_VERSION,
      "./js/core/registry.js?v=" + CACHE_VERSION,
      "./js/core/router.js?v=" + CACHE_VERSION,
      "./js/core/boot.js?v=" + CACHE_VERSION,

      "./js/screens/dashboard.js?v=" + CACHE_VERSION,
      "./js/screens/alignment.js?v=" + CACHE_VERSION,
      "./js/screens/maintenance.js?v=" + CACHE_VERSION,
      "./js/screens/path.js?v=" + CACHE_VERSION,
      "./js/screens/finance.js?v=" + CACHE_VERSION,
      "./js/screens/settings.js?v=" + CACHE_VERSION,
      "./js/screens/vault.js?v=" + CACHE_VERSION,

      "./assets/icons/icon-192.png",
      "./assets/icons/icon-512.png"
    ];

    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(ASSETS);
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    self.clients.claim();

    const keys = await caches.keys();
    for (const k of keys) {
      if (k !== CACHE_NAME) await caches.delete(k);
    }
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  if (!sameOrigin(req.url)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    if (isNavigationRequest(req)) {
      const cachedRoot = await cache.match("./", { ignoreSearch: true });
      if (cachedRoot) return cachedRoot;

      const cachedIndex = await cache.match("./index.html", { ignoreSearch: true });
      if (cachedIndex) return cachedIndex;

      try {
        return await fetch(req);
      } catch (e) {
        return new Response("Offline", { status: 200, headers: { "Content-Type": "text/plain" } });
      }
    }

    const cached = await cache.match(req, { ignoreSearch: false });
    if (cached) return cached;

    try {
      const net = await fetch(req);
      if (net && net.ok) {
        try { await cache.put(req, net.clone()); } catch (e) {}
      }
      return net;
    } catch (e) {
      return new Response("", { status: 504 });
    }
  })());
});
