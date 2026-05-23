// FinanceOS Service Worker
// Strategy: Network first, cache fallback
// Scope: /FinanceOS/

const CACHE_NAME = 'financeos-v2.2.0';
const CACHED_URLS = [
  '/FinanceOS/',
  '/FinanceOS/index.html',
  '/FinanceOS/styles.css',
  '/FinanceOS/state.js',
  '/FinanceOS/utils.js',
  '/FinanceOS/render_dashboard.js',
  '/FinanceOS/render_bills.js',
  '/FinanceOS/render_transactions.js',
  '/FinanceOS/render_accounts.js',
  '/FinanceOS/render_insights.js',
  '/FinanceOS/render_advisor.js',
  '/FinanceOS/app.js',
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
// Intercepts all app shell files (JS, CSS, HTML).
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Only handle same-origin requests for app shell files
  const isAppShell =
    url.origin === self.location.origin &&
    CACHED_URLS.some(u => url.pathname === u);

  if (!isAppShell) return; // Let CDN scripts and API calls pass through

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
          // Nothing cached yet — return minimal offline message
          return new Response(
            '<html><body style="font-family:sans-serif;text-align:center;padding:60px;background:#111111;color:#f5f5f5">' +
            '<h2>💼 FinanceOS</h2><p>You\'re offline and no cached version is available yet.</p>' +
            '<p>Open the app once while online to enable offline support.</p></body></html>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        });
      })
  );
});
