/* Offline-first cache. The app has no network dependencies at all;
   this simply makes it installable and usable with no connection. */
var CACHE = 'jyoti-v2';
var ASSETS = [
  './', './index.html', './css/style.css',
  './js/astro.js', './js/jyotish-data.js', './js/palm-data.js',
  './js/palm.js', './js/cities.js', './js/reading.js', './js/pandit.js',
  './js/vendor/anthropic-sdk.js', './js/app.js',
  './manifest.webmanifest', './icons/icon.svg'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(ASSETS.map(function (u) {
      return c.add(u).catch(function () { /* optional asset */ });
    }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; })
                           .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  // Never intercept the Claude API — it must always go to the network,
  // and a cached answer would be wrong as well as confusing.
  if (e.request.url.indexOf('api.anthropic.com') >= 0) return;
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      return hit || fetch(e.request).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); }).catch(function () {});
        return res;
      }).catch(function () { return caches.match('./index.html'); });
    })
  );
});
