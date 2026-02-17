const CACHE_NAME = 'pers-os-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './db.js',
  'https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;600&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});
