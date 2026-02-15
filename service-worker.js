const CACHE_NAME = "personal-os-v5";

const URLS = [
  "/",
  "/index.html",
  "/css/styles.css",
  "/manifest.webmanifest",

  "/js/db.js",
  "/js/ui.js",

  "/js/screens/mindset.js",
  "/js/screens/path.js",
  "/js/screens/maintenance.js",
  "/js/screens/finance.js",

  "/js/app.js"
];

self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(URLS))
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => k !== CACHE_NAME && caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});
