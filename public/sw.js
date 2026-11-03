// RockyEats service worker: phone alerts for staff (web push).
// It does not cache pages, so the site always loads the latest version.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'RockyEats', body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'RockyEats'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      tag: data.tag,
      renotify: true,
      requireInteraction: true, // stays on screen until someone looks at it
      icon: '/icon-192.png',
      badge: '/favicon.png',
      vibrate: [200, 100, 200, 100, 400],
      data: { url: data.url || '/dashboard' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || '/dashboard', self.location.origin).href
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const w of windows) {
        if (new URL(w.url).origin === self.location.origin) {
          await w.focus()
          if ('navigate' in w && w.url !== target) await w.navigate(target).catch(() => {})
          return
        }
      }
      await self.clients.openWindow(target)
    })(),
  )
})
