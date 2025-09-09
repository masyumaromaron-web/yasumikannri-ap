const cacheName = 'leave-app-v1';
const assetsToCache = [
  './',
  './index.html',
  './manifest.json',
  './app.js', // 外部JSの場合
  './style.css', // 外部CSSの場合
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(cacheName).then(cache => cache.addAll(assetsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});
