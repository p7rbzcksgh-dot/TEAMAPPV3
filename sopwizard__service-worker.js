const CACHE_KILL_VERSION = 'sopwizard-tcg-sop-wizard-clean-22-portrait-logo';
self.addEventListener('install', event => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => { /* caching disabled so GitHub Pages shows updates immediately */ });
