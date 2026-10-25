/* =========================================================
   النطاطة — عامل الخدمة (تشغيل بدون إنترنت)
   ========================================================= */
'use strict';

var CACHE = 'natata-v1.4.7';
var CORE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'assets/css/style.css?v=1.4.7',
  'assets/js/audio.js?v=1.4.7',
  'assets/js/art.js?v=1.4.7',
  'assets/js/game.js?v=1.4.7',
  'assets/js/online.js?v=1.4.7',
  'assets/js/ui.js?v=1.4.7',
  'assets/fonts/cairo-arabic.woff2',
  'assets/fonts/cairo-latin.woff2',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/maskable-512.png',
  'assets/icons/apple-touch-icon.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(CORE);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== CACHE) return caches.delete(key);
        return null;
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;

  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(function (response) {
        var copy = response.clone();
        caches.open(CACHE).then(function (cache) { cache.put(request, copy); });
        return response;
      }).catch(function () {
        return caches.match(request).then(function (hit) {
          return hit || caches.match('index.html');
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(function (hit) {
      var network = fetch(request).then(function (response) {
        if (response && response.status === 200) {
          var copy = response.clone();
          caches.open(CACHE).then(function (cache) { cache.put(request, copy); });
        }
        return response;
      }).catch(function () { return hit; });
      return hit || network;
    })
  );
});
