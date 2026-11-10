// Avisos de Mi Gym. El servidor manda un "toque" sin datos y aquí se pide el texto del aviso.
const PUSH_WORKER = 'https://mi-gym-polar.ekaitzmartinezm.workers.dev'

async function subHash(endpoint) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32)
}

self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      let msg = { title: 'Mi Gym', body: 'Tienes un aviso nuevo en Mi Gym.' }
      try {
        let data = null
        try {
          data = event.data ? event.data.json() : null
        } catch (e) {}
        if (data && data.title) msg = data
        else {
          const sub = await self.registration.pushManager.getSubscription()
          if (sub) {
            const r = await fetch(PUSH_WORKER + '/push/next?id=' + (await subHash(sub.endpoint)))
            const j = await r.json()
            if (j && j.title) msg = j
          }
        }
      } catch (e) {}
      await self.registration.showNotification(msg.title, {
        body: msg.body,
        icon: 'icon-192.png?v=5',
        badge: 'icon-192.png?v=5',
        data: { url: './' },
      })
    })()
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const c of all) if ('focus' in c) return c.focus()
      return self.clients.openWindow('./')
    })()
  )
})
