
const CACHE_KILL_VERSION = 'prodapp-tcg-dashboard-v15-clean';
self.addEventListener('install', event => { self.skipWaiting(); });
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', event => {
  // Intentionally no offline cache yet. This prevents old cached image/path problems during rollout.
});
