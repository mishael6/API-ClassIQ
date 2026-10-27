const CACHE_NAME = 'classiq-pwa-cache-v9';
const STATIC_ASSETS = [
  '/manifest.json',
  '/apple-touch-icon.png',
  '/assets/user-verification.png',
  '/favicon.ico',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) return caches.delete(cacheName);
        })
      )
    ).then(() => self.clients.claim())
  );
});

function isAppShell(request) {
  const url = new URL(request.url);
  if (request.mode === 'navigate') return true;
  if (url.pathname === '/' || url.pathname === '/index.html') return true;
  if (url.pathname.startsWith('/_expo/static/')) return true;
  return false;
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Always fetch fresh HTML + JS bundles after deploy (prevents blank screen)
  if (isAppShell(event.request)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) return response;
          return caches.match(event.request);
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

function parsePushData(event) {
  const defaults = {
    title: 'ClassIQ',
    body: 'You have a new notification.',
    icon: '/apple-touch-icon.png',
    url: '/',
  };

  if (!event.data) return defaults;

  try {
    return { ...defaults, ...event.data.json() };
  } catch (e) {
    try {
      const text = event.data.text();
      return { ...defaults, body: text || defaults.body };
    } catch (e2) {
      return defaults;
    }
  }
}

function notifyOpenClients(data) {
  return clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    list.forEach((client) => {
      client.postMessage({ type: 'classiq-push', title: data.title, body: data.body, url: data.url });
    });
  });
}

self.addEventListener('push', (event) => {
  const data = parsePushData(event);

  const title = data.title || 'ClassIQ';
  const body = data.body || 'You have a new notification.';

  const options = {
    body,
    icon: data.icon || '/apple-touch-icon.png',
    tag: 'classiq-notification',
    renotify: true,
    data: { url: data.url || '/' },
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
      .catch(() => self.registration.showNotification('ClassIQ', { body }))
      .then(() => notifyOpenClients({ title, body, url: data.url || '/' }))
      .catch((err) => {
        console.error('Push display failed:', err);
        return notifyOpenClients({ title, body, url: data.url || '/' });
      })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
