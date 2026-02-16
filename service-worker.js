// service-worker.js (FINAL, robust for GitHub Pages subpath + iOS PWA)

// IMPORTANT:
// - Uses dynamic base path (repo subpath) via registration scope
// - Cache version bump controls updates
// - Cache-first for app shell assets
// - Network fallback for everything else
// - skipWaiting + clients.claim for faster updates (still iOS-safe)

const CACHE_VERSION = "v1.0.0";
const CACHE_NAME = `personal-os-${CACHE_VERSION}`;

// Derive base path from SW scope (works on https://USER.github.io/REPO/ )
function getBasePath() {
  // self.registration.scope ends with '/'
  // Example: https://user.github.io/repo/
  const scopeUrl = new URL(self.registration.scope);
  return scopeUrl.pathname; // "/repo/" or "/"
}

function urlInScope(path) {
  const base = getBasePath();
  // Ensure single slash
  if (base.endsWith("/")) return base + path.replace(/^\/+/, "");
  return base + "/" + path.replace(/^\/+/, "");
}

// App shell assets (relative to GH Pages repo root)
const APP_SHELL = [
  "index.html",
  "css/styles.css",
  "manifest.webmanifest",

  "js/core/state.js",
  "js/core/registry.js",
  "js/core/router.js",
  "js/core/boot.js",

  "js/screens/dashboard.js",
  "js/screens/mindset.js",
  "js/screens/path.js",
  "js/screens/finance.js",
  "js/screens/maintenance.js",

  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png"
].map(urlInScope);

// Install: precache shell
self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL);
    }).catch((e) => {
      // If precache fails, still allow SW install
      console.error("SW precache failed", e);
    })
  );
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(
          keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve()))
        );
      } catch (e) {
        console.error("SW activate cleanup failed", e);
      }

      await self.clients.claim();
    })()
  );
});

// Fetch strategy:
// - For app shell requests in same-origin scope: cache-first
// - For navigation requests: try cache index.html, else network
// - For everything else: network-first with cache fallback (safe)
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle GET
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const inScope = sameOrigin && url.pathname.startsWith(getBasePath());

  // Navigation request: serve cached index.html for SPA shell
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const cache = await caches.open(CACHE_NAME);
          const cached = await cache.match(urlInScope("index.html"));
          if (cached) return cached;

          const net = await fetch(req);
          return net;
        } catch (e) {
          // Offline + no cached index.html => fallback
          const cache = await caches.open(CACHE_NAME);
          const cached = await cache.match(urlInScope("index.html"));
          if (cached) return cached;
          return new Response("Offline", { status: 503, statusText: "Offline" });
        }
      })()
    );
    return;
  }

  // Cache-first for app shell assets
  if (inScope && APP_SHELL.includes(url.href)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(req);
        if (cached) return cached;

        try {
          const res = await fetch(req);
          cache.put(req, res.clone());
          return res;
        } catch (e) {
          // Offline and not cached
          return new Response("Offline", { status: 503, statusText: "Offline" });
        }
      })()
    );
    return;
  }

  // For other same-origin requests: network-first with cache fallback
  if (inScope) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
          const res = await fetch(req);
          cache.put(req, res.clone());
          return res;
        } catch (e) {
          const cached = await cache.match(req);
          if (cached) return cached;
          return new Response("Offline", { status: 503, statusText: "Offline" });
        }
      })()
    );
  }
});
