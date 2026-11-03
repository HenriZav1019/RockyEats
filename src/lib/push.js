import { supabase } from './supabase.js'
import { detectPlatform, isStandalone } from './install.js'

// Phone alerts for staff (web push). Works with the dashboard closed:
// - Android (Chrome, Edge, Samsung): in the browser or installed.
// - iPhone (iOS 16.4+): ONLY when RockyEats was added to the home screen and
//   opened from that icon. Safari tabs can't receive push.

export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || ''

export function pushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    Boolean(VAPID_PUBLIC_KEY)
  )
}

// iPhone in a Safari tab: push becomes possible after installing.
export function pushNeedsInstall() {
  return detectPlatform() === 'ios' && !isStandalone()
}

function keyToBytes(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

async function registration() {
  const reg = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready
  return reg
}

async function save(sub) {
  const json = sub.toJSON()
  const { error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: json.endpoint,
    p_p256dh: json.keys?.p256dh,
    p_auth: json.keys?.auth,
  })
  if (error) throw error
}

// 'on' | 'off' | 'blocked' | 'unsupported' | 'needs-install'
export async function getPushState() {
  if (!pushSupported()) return pushNeedsInstall() ? 'needs-install' : 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  const reg = await navigator.serviceWorker.getRegistration('/')
  const sub = await reg?.pushManager.getSubscription()
  return sub && Notification.permission === 'granted' ? 'on' : 'off'
}

// Must be called from a tap. Returns the new state.
export async function enablePush() {
  if (!pushSupported()) return pushNeedsInstall() ? 'needs-install' : 'unsupported'
  if (Notification.permission === 'default') {
    try {
      await Notification.requestPermission()
    } catch {
      // ignore: handled by the permission check below
    }
  }
  if (Notification.permission !== 'granted') return Notification.permission === 'denied' ? 'blocked' : 'off'
  const reg = await registration()
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(VAPID_PUBLIC_KEY) })
  }
  await save(sub)
  return 'on'
}

export async function disablePush() {
  if (!('serviceWorker' in navigator)) return 'off'
  const reg = await navigator.serviceWorker.getRegistration('/')
  const sub = await reg?.pushManager.getSubscription()
  if (sub) {
    await supabase.rpc('remove_push_subscription', { p_endpoint: sub.endpoint })
    await sub.unsubscribe().catch(() => {})
  }
  return 'off'
}

// On dashboard load: if this phone already allowed alerts, make sure the
// subscription is saved for whoever is signed in now (shared tablets, new
// keys after a browser update). Never asks for permission.
export async function syncPush() {
  try {
    if (!pushSupported() || Notification.permission !== 'granted') return
    const reg = await registration()
    let sub = await reg.pushManager.getSubscription()
    // Permission is already granted, so this doesn't prompt (after sign-out
    // removed the old subscription, for example).
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(VAPID_PUBLIC_KEY) })
    await save(sub)
  } catch (err) {
    console.warn('[push] sync failed', err)
  }
}
