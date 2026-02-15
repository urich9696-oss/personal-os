const CACHE_NAME = "personal-os-v2";

const URLS = [
  "/",
  "/index.html",
  "/css/styles.css",
  "/manifest.webmanifest",

  "/js/app.js",
  "/js/db.js",
  "/js/ui.js",

  "/js/screens/mindset.js",
  "/js/screens/path.js",
  "/js/screens/maintenance.js",
  "/js/screens/finance.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(URLS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
