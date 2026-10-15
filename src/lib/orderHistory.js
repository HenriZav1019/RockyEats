// The customer's orders on this device. Customers don't have accounts, so
// this is how "Mis pedidos" knows what they ordered. Entries are kept after
// delivery (they become "Pedidos anteriores"); the live status always comes
// from the server via get_order_confirmation.

const STORAGE_KEY = 'rockyeats_order_history'
const LEGACY_KEY = 'rockyeats_pending_orders'
const MAX_ENTRIES = 30
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000
export const FINAL_STATUSES = ['completed', 'cancelled']

function safeGet(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function readAll() {
  let list = []
  try {
    list = JSON.parse(safeGet(STORAGE_KEY) || '[]')
  } catch {
    list = []
  }
  // One-time import of orders saved by the previous version.
  const legacy = safeGet(LEGACY_KEY)
  if (legacy) {
    try {
      for (const o of JSON.parse(legacy)) {
        if (!list.some((e) => e.id === o.id)) list.push({ ...o, lastStatus: null, seenFinal: false })
      }
      // Save the merged list before dropping the old key, or the import is lost.
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
      localStorage.removeItem(LEGACY_KEY)
    } catch {
      // ignore a corrupt legacy entry
    }
  }
  const cutoff = Date.now() - MAX_AGE_MS
  return list.filter((o) => o?.id && o.createdAt > cutoff)
}

function writeAll(list) {
  try {
    const trimmed = [...list].sort((a, b) => b.createdAt - a.createdAt).slice(0, MAX_ENTRIES)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch {
    // Private mode or storage full: history just won't persist.
  }
}

// Newest first.
export function getOrderHistory() {
  return readAll().sort((a, b) => b.createdAt - a.createdAt)
}

export function addOrder({ id, orderNumber, restaurantId, restaurantName, createdAt }) {
  const list = readAll().filter((o) => o.id !== id)
  list.push({
    id,
    orderNumber,
    restaurantId,
    restaurantName,
    createdAt: createdAt ? new Date(createdAt).getTime() : Date.now(),
    lastStatus: 'submitted',
    seenFinal: false,
  })
  writeAll(list)
  window.dispatchEvent(new Event('rockyeats:orders-added'))
}

export function updateOrder(id, patch) {
  const list = readAll()
  const entry = list.find((o) => o.id === id)
  if (!entry) return
  const changed = Object.entries(patch).some(([k, v]) => entry[k] !== v)
  if (!changed) return
  Object.assign(entry, patch)
  writeAll(list)
  // Let other views (the banner, Mis pedidos) pick up the change right away.
  window.dispatchEvent(new Event('rockyeats:orders-updated'))
}

export function removeOrder(id) {
  writeAll(readAll().filter((o) => o.id !== id))
}
