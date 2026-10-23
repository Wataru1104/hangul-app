// オフラインでも開けるように、ファイルを保存しておく仕組み。
// 先にネットから最新を取り、つながらないときだけ 保存したものを使います。
importScripts('audio/map.js');
var CACHE = 'hangul-v5';
var FILES = Object.keys(AUDIO_MAP).map(function (k) { return AUDIO_MAP[k]; }).concat(['audio/map.js','./', 'index.html', 'style.css', 'data.js', 'data2.js', 'app.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-180.png']);
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }));
  self.skipWaiting();
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }));
  self.clients.claim();
});
self.addEventListener('fetch', function (e) {
  e.respondWith(fetch(e.request).then(function (r) {
    var copy = r.clone();
    caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
    return r;
  }).catch(function () { return caches.match(e.request); }));
});
