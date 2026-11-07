/* HappyClass – service worker cho chế độ chơi offline.
 * Chỉ lưu những gì cần để mở trang "Chơi offline" khi mất mạng:
 *   - trang /offline (mạng trước, mất mạng thì dùng bản đã lưu);
 *   - file tĩnh /_next/static (đặt tên theo hash nên lưu lâu dài);
 *   - ảnh thư viện /api/media/<id> (không đổi theo id).
 * Không lưu trang khác, không lưu API có dữ liệu cá nhân. Gói nội dung do trang offline tự lưu vào Cache Storage.
 */
const VERSION = 'hc-offline-v1';
const PAGES = `${VERSION}-pages`;
const STATIC = `${VERSION}-static`;
const MEDIA = 'hc-media-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([PAGES, STATIC, MEDIA, 'hc-packs-v1']);
    for (const name of await caches.keys()) if (!keep.has(name)) await caches.delete(name);
    await self.clients.claim();
  })());
});

const isOfflinePage = (url) => /\/offline\/?$/.test(url.pathname);

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate' && isOfflinePage(url)) {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) (await caches.open(PAGES)).put(url.pathname, res.clone());
        return res;
      } catch {
        const cached = await (await caches.open(PAGES)).match(url.pathname);
        return cached || new Response('<h1>Chưa tải chế độ offline</h1><p>Hãy mở trang này một lần khi có mạng.</p>', { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } });
      }
    })());
    return;
  }

  const cacheFirst = (cacheName) => event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    const hit = await cache.match(req);
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  })());

  if (url.pathname.startsWith('/_next/static/')) return cacheFirst(STATIC);
  if (/^\/api\/media\/[0-9a-f-]{36}$/.test(url.pathname)) return cacheFirst(MEDIA);
});
