// FinanceOS Service Worker
// Strategy: Network first, cache fallback
// Scope: /FinanceOS/

const CACHE_NAME = 'financeos-v1.9.7';
const CACHED_URLS = [
  '/FinanceOS/',
  '/FinanceOS/index.html',
];

// ── INSTALL ──────────────────────────────────────────────────
// Pre-cache the shell on first install
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CACHED_URLS))
  );
  // Take over immediately without waiting for old SW to finish
  self.skipWaiting();
});

// ── ACTIVATE ─────────────────────────────────────────────────
// Delete old caches when a new SW version takes over
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  // Claim all open tabs immediately
  self.clients.claim();
});

// ── FETCH ─────────────────────────────────────────────────────
// Network first → cache fallback
// Only intercept navigation requests for the app shell.
// All other requests (CDN scripts, etc.) pass through normally.
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Only handle same-origin requests for the app shell
  const isAppShell =
    url.origin === self.location.origin &&
    (url.pathname === '/FinanceOS/' || url.pathname === '/FinanceOS/index.html');

  if (!isAppShell) return; // Let everything else pass through untouched

  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        // Fresh response from network — update the cache
        const clone = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return networkResponse;
      })
      .catch(() => {
        // Network failed — serve cached version
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Nothing cached yet either — return a minimal offline message
          return new Response(
            '<html><body style="font-family:sans-serif;text-align:center;padding:60px;background:#080812;color:#e2e2ff">' +
            '<h2>💼 FinanceOS</h2><p>You\'re offline and no cached version is available yet.</p>' +
            '<p>Open the app once while online to enable offline support.</p></body></html>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        });
      })
  );
});
