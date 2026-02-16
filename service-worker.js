// service-worker.js (FINAL, robust for GitHub Pages subpath + iOS PWA)

const CACHE_VERSION = "v1.0.1"; // bump on every deploy
const CACHE_NAME = `personal-os-${CACHE_VERSION}`;

// Derive base path from SW scope (works on https://USER.github.io/REPO/ )
function getBasePath() {
  const scopeUrl = new URL(self.registration.scope);
  return scopeUrl.pathname; // "/repo/" or "/"
}

function urlInScope(path) {
  const base = getBasePath();
  if (base.endsWith("/")) return base + path.replace(/^\/+/, "");
  return base + "/" + path.replace(/^\/+/, "");
}

function normalizePathname(pathname) {
  try {
    const base = getBasePath();
    // strip base prefix: "/repo/js/core/x.js" -> "/js/core/x.js"
    if (pathname.startsWith(base)) return "/" + pathname.slice(base.length).replace(/^\/+/, "");
    return pathname;
  } catch (_) {
    return pathname;
  }
}

// App shell assets (relative to GH Pages repo root)
const SHELL_PATHS = [
  "/index.html",
  "/css/styles.css",
  "/manifest.webmanifest",

  "/js/core/state.js",
  "/js/core/registry.js",
  "/js/core/router.js",
  "/js/core/boot.js",

  "/js/screens/dashboard.js",
  "/js/screens/mindset.js",
  "/js/screens/path.js",
  "/js/screens/finance.js",
  "/js/screens/maintenance.js",
  "/js/screens/vault.js",

  "/assets/icons/icon-192.png",
  "/assets/icons/icon-512.png"
];

// Convert to absolute URLs within the SW scope (GH Pages subpath safe)
const APP_SHELL = SHELL_PATHS.map((p) => urlInScope(p.replace(/^\/+/, "")));

function isShellRequest(url) {
  try {
    const path = normalizePathname(url.pathname);
    return SHELL_PATHS.indexOf(path) !== -1;
  } catch (_) {
    return false;
  }
}

// Install: precache shell
self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(APP_SHELL);
      } catch (e) {
        // If precache fails, still allow SW install
        console.error("SW precache failed", e);
      }
    })()
  );
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())));
      } catch (e) {
        console.error("SW activate cleanup failed", e);
      }
      await self.clients.claim();
    })()
  );
});

// Fetch strategy:
// - Navigation: serve cached index.html (ignoreSearch) fallback network
// - App shell assets: cache-first (ignoreSearch), fallback network then cache
// - Other same-origin in-scope: network-first with cache fallback
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const base = getBasePath();
  const inScope = sameOrigin && url.pathname.startsWith(base);

  if (!inScope) return;

  // Navigation request: serve cached index.html for SPA shell
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);

        try {
          const cached = await cache.match(urlInScope("index.html"), { ignoreSearch: true });
          if (cached) return cached;

          const net = await fetch(req);
          return net;
        } catch (_) {
          const cached2 = await cache.match(urlInScope("index.html"), { ignoreSearch: true });
          if (cached2) return cached2;
          return new Response("Offline", { status: 503, statusText: "Offline" });
        }
      })()
    );
    return;
  }

  // App shell assets: cache-first (ignoreSearch)
  if (isShellRequest(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);

        // Try exact request (with query) but ignoreSearch => hit
        const cached = await cache.match(req, { ignoreSearch: true });
        if (cached) return cached;

        // Also try normalized shell URL
        const path = normalizePathname(url.pathname).replace(/^\/+/, "");
        const shellUrl = urlInScope(path);
        const cached2 = await cache.match(shellUrl, { ignoreSearch: true });
        if (cached2) return cached2;

        try {
          const res = await fetch(req);
          // Store under the original request URL (fine) and shellUrl (more robust)
          cache.put(req, res.clone());
          try { cache.put(shellUrl, res.clone()); } catch (_) {}
          return res;
        } catch (_) {
          return new Response("Offline", { status: 503, statusText: "Offline" });
        }
      })()
    );
    return;
  }

  // Other same-origin requests: network-first with cache fallback
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const res = await fetch(req);
        cache.put(req, res.clone());
        return res;
      } catch (_) {
        const cached = await cache.match(req, { ignoreSearch: true });
        if (cached) return cached;
        return new Response("Offline", { status: 503, statusText: "Offline" });
      }
    })()
  );
});
