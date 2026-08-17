const STORAGE_KEY = 'rockyeats_pending_orders'
const MAX_AGE_MS = 48 * 60 * 60 * 1000 // orders older than this stop showing as "in progress"

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeAll(orders) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders))
}

export function addPendingOrder({ id, orderNumber, restaurantId, restaurantName }) {
  const orders = readAll().filter((o) => o.id !== id)
  orders.push({ id, orderNumber, restaurantId, restaurantName, createdAt: Date.now() })
  writeAll(orders)
}

export function removePendingOrder(id) {
  writeAll(readAll().filter((o) => o.id !== id))
}

export function getActivePendingOrders() {
  const all = readAll()
  const fresh = all.filter((o) => Date.now() - o.createdAt < MAX_AGE_MS)
  if (fresh.length !== all.length) writeAll(fresh)
  return fresh
}
