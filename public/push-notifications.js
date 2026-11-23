self.addEventListener('push', (event) => {
  if (!event.data) return;
  const { title, body, tag } = event.data.json();
  event.waitUntil(self.registration.showNotification(title, {
    body,
    tag,
    icon: '/pwa-192x192.png',
  }));
});

self.addEventListener('notificationclick', (event) => {
  if (!event.notification.tag.startsWith('tuitio-fees-')) return;
  event.notification.close();
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const client = clients.find((window) => new URL(window.url).origin === self.location.origin);
    if (client) {
      await client.focus();
      client.postMessage({ type: 'open-fee-alerts' });
    } else {
      await self.clients.openWindow('/?view=notifications');
    }
  })());
});
