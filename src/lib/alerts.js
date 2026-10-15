import { playChime, unlockAudio, isAudioUnlocked } from './chime.js'
import { formatMoney } from './format.js'

// New-order alerts: the chime (needs one tap to unlock audio) and, when the
// browser allows it, a system notification so the owner hears about orders
// even with the dashboard in a background tab.

export function notificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function alertsReady() {
  const notif = !notificationsSupported() || Notification.permission !== 'default'
  return isAudioUnlocked() && notif
}

// Must be called from a tap/click.
export async function enableAlerts() {
  const sound = await unlockAudio()
  if (notificationsSupported() && Notification.permission === 'default') {
    try {
      await Notification.requestPermission()
    } catch {
      // Some browsers (older Safari) only support the callback form; ignore.
    }
  }
  return sound
}

export function announceNewOrders(orders) {
  if (!orders.length) return
  playChime()
  if (!notificationsSupported() || Notification.permission !== 'granted' || !document.hidden) return
  for (const o of orders.slice(0, 3)) {
    try {
      const n = new Notification(`Nuevo pedido ${o.order_number}`, {
        body: `${o.customer_name} · ${formatMoney(o.total)}`,
        tag: o.id,
        icon: '/icon-192.png',
      })
      n.onclick = () => {
        window.focus()
        n.close()
      }
    } catch {
      // Mobile Chrome only allows notifications through a service worker;
      // the chime and on-screen highlight still work there.
    }
  }
}
