// v2: ล้างแคช /_next/static รุ่น v1 ที่อาจค้างจากตอนพัฒนา (activate ลบแคชชื่ออื่นให้อัตโนมัติ)
const CACHE_NAME = 'ebooks-v2';
const OFFLINE_URL = '/offline.html';

// localhost/127.0.0.1: ไม่แคช /_next/static — ตอน dev ชื่อไฟล์ไม่มี hash ถ้าแคชแบบ
// cache-first จะได้ JS เก่าค้างแม้แก้โค้ดแล้ว (บน production ชื่อไฟล์มี hash จึงแคชได้ปลอดภัย)
const IS_LOCAL_HOST = ['localhost', '127.0.0.1', '[::1]'].includes(self.location.hostname);

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

  // Static assets — cache first (ข้ามบน localhost ดูเหตุผลด้านบน)
  if (!IS_LOCAL_HOST && url.pathname.startsWith('/_next/static/')) {
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
