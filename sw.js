const cacheName = 'leave-app-v1';
const assetsToCache = [
  './',
  './index.html',
  './manifest.json',
  './app.js',
  './style.css',
  './icon-192.png',
  './icon-512.png'
];

// インストール：キャッシュ作成
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(cacheName).then(cache => cache.addAll(assetsToCache))
  );
  self.skipWaiting(); // すぐに新バージョンを適用
});

// アクティベート：古いキャッシュ削除
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => {
        if (key !== cacheName) {
          return caches.delete(key);
        }
      }))
    )
  );
  self.clients.claim(); // ページを即制御
});

// フェッチ：キャッシュ優先
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});
