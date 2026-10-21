/* D'Corner Pickleball Court — service worker (GitHub Pages wrapper only).
   Caches the wrapper shell so the site opens instantly and shows a friendly
   offline screen instead of the browser's "No internet" page. The booking app
   itself lives on Google Apps Script (a different origin) and always needs a
   connection for live availability. */
const CACHE = 'dcorner-shell-v1';
const SHELL = ['./', './index.html', './favicon-32x32.png', './favicon-16x16.png', './apple-touch-icon.png'];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE)
      .then(function (cache) {
        return Promise.all(SHELL.map(function (url) { return cache.add(url).catch(function () {}); }));
      })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never touch Google Apps Script / Supabase

  // Page loads: network first (always the newest wrapper), cache when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(function (res) {
          const copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put('./index.html', copy); });
          return res;
        })
        .catch(function () {
          return caches.match('./index.html').then(function (hit) { return hit || caches.match('./'); });
        })
    );
    return;
  }

  // Icons and other static files: cache first, refresh in the background.
  event.respondWith(
    caches.match(req).then(function (hit) {
      const fresh = fetch(req).then(function (res) {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
        return res;
      }).catch(function () { return hit; });
      return hit || fresh;
    })
  );
});
