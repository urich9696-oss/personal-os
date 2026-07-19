const CACHE = "personalos-shell-v4";
const SHELL = [
  "./", "./index.html", "./manifest.webmanifest", "./css/base.css", "./css/components.css",
  "./js/app.js", "./js/db.js", "./js/state.js", "./js/router.js",
  "./js/utils/date.js", "./js/utils/format.js", "./js/services/data.js",
  "./js/components/ui.js", "./js/components/capture.js", "./js/components/onboarding.js",
  "./js/views/dashboard.js", "./js/views/tasks.js", "./js/views/calendar.js",
  "./js/views/path.js", "./js/views/blocks.js", "./js/views/more.js",
  "./js/views/journal.js", "./js/views/finance.js", "./js/views/maintenance.js",
  "./js/views/settings.js", "./assets/icons/icon.svg", "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png"
];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== location.origin) return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (response.ok) caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
    return response;
  }).catch(() => event.request.mode === "navigate" ? caches.match("./index.html") : Response.error())));
});
