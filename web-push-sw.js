/* Web Push only. Normal application pages continue to load from the network. */
self.addEventListener('push', event => {
  let data;
  try { data = event.data?.json(); } catch { return; }
  if (!data || !/^IPN-\d{4}-\d{4,12}$/.test(data.job || '') || typeof data.title !== 'string') return;
  const url = new URL('vnext-job.html', self.registration.scope);
  url.searchParams.set('id', data.job);
  url.searchParams.set('notification', '1');
  if (/^[A-Za-z0-9_-]{1,30}$/.test(data.department || '')) url.searchParams.set('department', data.department);
  if (/^[a-f\d-]{36}$/i.test(data.tag?.slice(5) || '')) url.searchParams.set('assignment', data.tag.slice(5));
  event.waitUntil(self.registration.showNotification(data.title.slice(0, 120), {
    body: 'แตะเพื่อเปิดรายละเอียดใน Complain',
    icon: new URL('web-push-icon-192.png', self.registration.scope).href,
    tag: data.tag,
    data: { url: url.href }
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  let target;
  try {
    target = new URL(event.notification.data?.url);
    const jobPage = new URL('vnext-job.html', self.registration.scope);
    if (target.origin !== jobPage.origin || target.pathname !== jobPage.pathname) return;
  } catch { return; }
  event.waitUntil((async () => {
    for (const client of await clients.matchAll({ type: 'window', includeUncontrolled: true })) {
      if (client.url === target.href) return client.focus();
    }
    return clients.openWindow(target.href);
  })());
});
