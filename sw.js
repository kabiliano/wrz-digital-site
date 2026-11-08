// sw.js — à placer à la RACINE du site vitrine www.wrz-digital.com (à côté de index.html)
// Rôle : désinstaller l'ancien service worker de l'ancien site (Hostinger, fond violet)
// chez les visiteurs qui l'ont encore en cache, puis recharger la page sur le nouveau site.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((c) => c.navigate(c.url));
  })());
});
