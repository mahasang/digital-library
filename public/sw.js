const CACHE_NAME = 'ebooks-v1';
const OFFLINE_URL = '/offline.html';

// Precache offline page เท่านั้น
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// NetworkOnly สำหรับ auth/API/Supabase
const NETWORK_ONLY = [
  /supabase\.co/,
  /^\/api\//,
  /\/storage\/v1\/object\//,
  /\/(th|en|lo|vi)\/(dashboard|superadmin|auth|login|register|mfa-challenge|setup-mfa)/,
];

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // NetworkOnly — ไม่แตะเลย
  if (NETWORK_ONLY.some((r) => r.test(url.pathname + url.hostname))) return;

  // Navigate request — offline fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(OFFLINE_URL)
      )
    );
    return;
  }

  // Static assets — cache first
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(event.request).then((cached) =>
        cached || fetch(event.request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
          return res;
        })
      )
    );
  }
});
