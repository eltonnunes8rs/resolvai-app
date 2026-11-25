// Service worker do ResolvAÍ: deixa o app instalável e abrir sem internet (só a "casca").
// Rede primeiro: sempre tenta a versão nova; usa o cache só se estiver sem conexão.
// A API (n8n) e version.json nunca passam pelo cache.
var CACHE = 'resolvai-casca';
var CASCA = ['./', 'index.html', 'style.css', 'app.js', 'pwa.js', 'config.js', 'logo.svg', 'icone-192.png', 'icone-512.png', 'manifest.webmanifest'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(CASCA); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.endsWith('version.json')) return;
  e.respondWith(
    fetch(req, { cache: 'no-cache' }).then(function (r) {
      if (r && r.ok) { var copia = r.clone(); caches.open(CACHE).then(function (c) { c.put(req, copia); }); }
      return r;
    }).catch(function () { return caches.match(req).then(function (m) { return m || caches.match('index.html'); }); })
  );
});
