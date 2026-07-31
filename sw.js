// ─────────────────────────────────────────────────────────────
//  FinanceOS Service Worker — offline-first, Safari/iOS compatible
//  Bump CACHE_VERSION on every deploy to force clients to update.
//  (Keep this in sync with APP_VERSION in index.html.)
// ─────────────────────────────────────────────────────────────

const CACHE_VERSION = "v2.0.0";
const CACHE_NAME    = `financeos-${CACHE_VERSION}`;

const LOCAL_ASSETS = [
  "/",
  "/index.html",
  "/sw.js",
];

// Only external dependency: xlsx-js-style, lazy-loaded when the user taps
// Export to Excel. Pre-cached here so Export still works offline once it's
// been loaded successfully at least once.
const CDN_ASSETS = [
  "https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js",
];

const OFFLINE_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>FinanceOS - Offline</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #111111; color: #f5f5f5;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; text-align: center; padding: 40px 24px;
    }
    .wrap { max-width: 320px; }
    .logo { color: #5070f0; font-size: 24px; font-weight: 700; margin-bottom: 28px; }
    .icon { font-size: 44px; margin-bottom: 20px; }
    h2 { color: #f5f5f5; font-size: 17px; font-weight: 700; margin-bottom: 10px; }
    p { color: #777777; font-size: 13px; line-height: 1.6; margin-bottom: 24px; }
    button {
      background: #5070f0; color: #fff; border: none; border-radius: 10px;
      padding: 12px 20px; font-size: 14px; font-weight: 600; cursor: pointer;
      font-family: inherit;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="logo">FinanceOS</div>
    <div class="icon">&#9992;&#65039;</div>
    <h2>You're Offline</h2>
    <p>No connection right now. Open FinanceOS once while connected to Wi-Fi or cellular to enable full offline access to your data.</p>
    <button onclick="location.reload()">Try Again</button>
  </div>
</body>
</html>`;

// ── Install: pre-cache everything ────────────────────────────
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      await Promise.allSettled(
        LOCAL_ASSETS.map(url =>
          cache.add(url).catch(err => console.warn(`[SW] local cache miss: ${url}`, err))
        )
      );
      await Promise.allSettled(
        CDN_ASSETS.map(url =>
          fetch(url, { mode: "no-cors" })
            .then(res => { if (res) cache.put(url, res); })
            .catch(err => console.warn(`[SW] CDN cache miss: ${url}`, err))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: delete old caches ──────────────────────────────
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k.startsWith("financeos-") && k !== CACHE_NAME)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first, Safari-safe ──────────────────────────
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isCDN = CDN_ASSETS.some(u => event.request.url.startsWith(u.split("?")[0]));

  event.respondWith(
    caches.match(event.request).then(cached => {

      // Cache hit — serve immediately, revalidate in background (same-origin only)
      if (cached) {
        if (isSameOrigin) {
          fetch(event.request)
            .then(res => {
              if (res && res.ok) caches.open(CACHE_NAME).then(c => c.put(event.request, res));
            })
            .catch(() => {});
        }
        return cached;
      }

      // Cache miss — same-origin assets (index.html itself, etc.)
      if (isSameOrigin) {
        return fetch(event.request)
          .then(res => {
            if (res && res.ok) {
              caches.open(CACHE_NAME).then(c => c.put(event.request, res.clone()));
            }
            return res;
          })
          .catch(() => {
            if (event.request.mode === "navigate") {
              return caches.match("/index.html").then(r => r ||
                new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } })
              );
            }
            return new Response("Offline", { status: 503 });
          });
      }

      // Cache miss — CDN assets (xlsx export library)
      if (isCDN) {
        return fetch(event.request, { mode: "no-cors" })
          .then(res => {
            if (res) caches.open(CACHE_NAME).then(c => c.put(event.request, res.clone()));
            return res;
          })
          .catch(() => new Response("Offline", { status: 503 }));
      }

      // Everything else
      return fetch(event.request).catch(() => new Response("Offline", { status: 503 }));
    })
  );
});

// ── Message: skipWaiting from app ────────────────────────────
self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
