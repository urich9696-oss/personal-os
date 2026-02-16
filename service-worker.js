/* PERSONAL OS — Service Worker (GitHub Pages subpath safe, offline-first)
 *
 * Goals:
 * - Works under https://USERNAME.github.io/personal-os/ (subpath)
 * - Cache app shell for offline start
 * - SPA navigation: serve cached index.html for navigations
 * - Versioning via CACHE_VERSION bump
 * - Kill switch handled in boot.js via ?nosw=1 (unregister + caches delete + reload)
 */

const CACHE_VERSION = "0.1.0";
const CACHE_NAME = `personal-os-${CACHE_VERSION}`;

// Derive base path from SW scope (ends with '/')
function getBasePath() {
  try {
    const url = new URL(self.registration.scope);
    return url.pathname; // e.g. "/personal-os/"
  } catch (e) {
    return "/";
  }
}

function withBase(path) {
  const base = getBasePath();
  // Ensure no leading slash in path
  const p = path.startsWith("/") ? path.slice(1) : path;
  return base + p;
}

// App shell assets to precache
function precacheList() {
  return [
    withBase("index.html?v=" + CACHE_VERSION),
    withBase("css/styles.css?v=" + CACHE_VERSION),

    withBase("js/core/ui.js?v=" + CACHE_VERSION),
    withBase("js/core/db.js?v=" + CACHE_VERSION),
    withBase("js/core/state.js?v=" + CACHE_VERSION),
    withBase("js/core/registry.js?v=" + CACHE_VERSION),
    withBase("js/core/router.js?v=" + CACHE_VERSION),
    withBase("js/core/boot.js?v=" + CACHE_VERSION),

    withBase("js/screens/dashboard.js?v=" + CACHE_VERSION),
    withBase("js/screens/alignment.js?v=" + CACHE_VERSION),
    withBase("js/screens/maintenance.js?v=" + CACHE_VERSION),
    withBase("js/screens/path.js?v=" + CACHE_VERSION),
    withBase("js/screens/finance.js?v=" + CACHE_VERSION),
    withBase("js/screens/settings.js?v=" + CACHE_VERSION),
    withBase("js/screens/vault.js?v=" + CACHE_VERSION),

    withBase("manifest.webmanifest"),
    withBase("assets/icons/icon-192.png"),
    withBase("assets/icons/icon-512.png")
  ];
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Use addAll; if any fails (e.g., missing icons) install will fail
    await cache.addAll(precacheList());
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.map((k) => (k.startsWith("personal-os-") && k !== CACHE_NAME) ? caches.delete(k) : Promise.resolve())
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle GET
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const basePath = getBasePath();

  // Only handle same-origin and within scope path
  const sameOrigin = url.origin === self.location.origin;
  const inScope = url.pathname.startsWith(basePath);
  if (!sameOrigin || !inScope) return;

  // SPA navigation -> serve cached index.html
  const isNav = req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");
  if (isNav) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);

      // Prefer cached index.html (without query)
      const cached = await cache.match(withBase("index.html?v=" + CACHE_VERSION));
      if (cached) return cached;

      // Fallback network then cache
      try {
        const fresh = await fetch(withBase("index.html?v=" + CACHE_VERSION), { cache: "no-store" });
        if (fresh && fresh.ok) cache.put(withBase("index.html?v=" + CACHE_VERSION), fresh.clone());
        return fresh;
      } catch (e) {
        // Absolute last resort: try bare index.html
        const cached2 = await cache.match(withBase("index.html"));
        if (cached2) return cached2;
        return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
      }
    })());
    return;
  }

  // Cache-first for all other app assets within scope
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    if (cached) return cached;

    try {
      const fresh = await fetch(req);
      if (fresh && fresh.ok) {
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch (e) {
      return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
    }
  })());
});
