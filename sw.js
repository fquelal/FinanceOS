 const CACHE_NAME = 'financeos-v1.6.0';

const PRECACHE_URLS = [
  '/',
  '/index.html'
];

// Install — precache core assets only (no CDN URLs)
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate — delete old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch — Cache First with captive portal protection
self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Skip cross-origin requests (CDN, APIs) — let them go straight to network
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      // Not in cache — fetch from network and cache the result
      return fetch(event.request).then(response => {
        // Guard against captive portal responses:
        // Only cache same-origin, status 200, non-opaque responses
        if (
          !response ||
          response.status !== 200 ||
          response.type === 'opaque' ||
          response.type === 'error'
        ) {
          return response;
        }

        // Extra captive portal check: if we asked for index.html but got
        // something that isn't HTML (or is a redirect page), don't cache it
        if (
          event.request.url.endsWith('.html') || event.request.url.endsWith('/')
        ) {
          const contentType = response.headers.get('content-type') || '';
          if (!contentType.includes('text/html')) return response;
        }

        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => {
        // Network failed entirely — nothing in cache either, return offline fallback
        return caches.match('/index.html');
      });
    })
  );
});
