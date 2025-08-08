self.addEventListener('install', function(e) { self.skipWaiting(); });
self.addEventListener('activate', function(e) { self.clients.claim(); });
self.addEventListener('fetch', function(e) {
  const req = e.request;
  const url = req.url;
  if (url.includes('/proxy?url=')) return;
  if (req.method !== 'GET') return;
  e.respondWith(fetch(req));
});
