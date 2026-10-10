/* Iron Ledger service worker: works offline, always prefers the newest files when online.
   Bump VERSION when you deploy to clear old caches. */
const VERSION = 'iron-ledger-v2';
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'icons/icon.svg',
  'icons/icon-192.png',
  'js/actions.js',
  'js/charts.js',
  'js/core.js',
  'js/engine.js',
  'js/equipment.js',
  'js/features/alerts.js',
  'js/features/cardio.js',
  'js/features/comeback.js',
  'js/features/plates.js',
  'js/features/share.js',
  'js/features/timing.js',
  'js/fun.js',
  'js/main.js',
  'js/registry.js',
  'js/sample.js',
  'js/state.js',
  'js/ui.js',
  'js/views/data.js',
  'js/views/equipment.js',
  'js/views/goals.js',
  'js/views/history.js',
  'js/views/plans.js',
  'js/views/projection.js',
  'js/views/report.js',
  'js/views/today.js',
  'js/views/trophies.js',
  'js/views/wizard.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// Network first, cache fallback (so updates show up right away, and the gym basement still works)
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    fetch(req).then(res => {
      if (res && res.ok && (new URL(req.url).origin === location.origin || req.url.includes('fonts.g'))) {
        const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || (req.mode === 'navigate' ? caches.match('index.html') : undefined)))
  );
});

// Rest timer alerts. The page posts the time rest ends; if the page isn't on screen then, show a notification.
let restId = null;
self.addEventListener('message', e => {
  const d = e.data || {};
  if (d.type === 'rest-cancel') { restId = null; return; }
  if (d.type !== 'rest') return;
  restId = d.id;
  const wait = Math.max(0, Math.min(d.at - Date.now(), 290000));
  e.waitUntil(new Promise(r => setTimeout(r, wait)).then(async () => {
    if (restId !== d.id) return;
    restId = null;
    if (!d.force) {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (wins.some(c => c.visibilityState === 'visible')) return; // the page beeps and vibrates on its own
    }
    return self.registration.showNotification(d.title, {
      body: d.body, tag: 'rest', renotify: true, vibrate: [250, 120, 250, 120, 400],
      icon: 'icons/icon-192.png', badge: 'icons/icon-192.png'
    });
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(wins => wins.length ? wins[0].focus() : self.clients.openWindow('./')));
});
