const CACHE = 'menuzap-v1';

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(['/'])));
});

self.addEventListener('activate', e => e.waitUntil(clients.claim()));

self.addEventListener('fetch', e => {
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() =>
        caches.match('/').then(r => r || Response.error())
      )
    );
  }
});

self.addEventListener('push', e => {
  const data = e.data?.json() ?? {};
  e.waitUntil(
    self.registration.showNotification(data.title ?? '🔔 MenuZap', {
      body: data.body ?? 'Novo pedido recebido!',
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: 'new-order',
      renotify: true,
    })
  );
});
