const CACHE = 'menuzap-v10';

self.addEventListener('install', e => {
  // Limpa tudo e força ativação imediata
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => caches.open(CACHE).then(c => c.addAll(['/index.html'])))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.hostname.includes('supabase')) return;

  if (url.origin === self.location.origin) {
    // Network-first: sempre busca o código mais recente, usa cache só offline
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match(e.request).then(r => r || Response.error()))
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
