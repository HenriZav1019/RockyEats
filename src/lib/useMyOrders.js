import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase.js'
import { FINAL_STATUSES, getOrderHistory, removeOrder, updateOrder } from './orderHistory.js'

const POLL_MS = 10000

// Live view of this device's orders.
//  scope 'active': only orders that may still change (cheap; used by the banner)
//  scope 'all': every saved order with full details (Mis pedidos page)
// Active orders are re-checked every 10 s and whenever the page becomes
// visible again, so "Entregado" shows up without reloading.
export function useMyOrders(scope = 'active') {
  const [orders, setOrders] = useState(() => getOrderHistory().map((entry) => ({ entry, data: null })))
  const [loading, setLoading] = useState(true)
  const busy = useRef(false)

  const refresh = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    const history = getOrderHistory()
    const toFetch = scope === 'all' ? history : history.filter((e) => !FINAL_STATUSES.includes(e.lastStatus) || !e.seenFinal)
    const results = await Promise.all(
      toFetch.map(async (entry) => {
        const { data, error } = await supabase.rpc('get_order_confirmation', { p_order_id: entry.id })
        if (error) return { entry, data: null, failed: true }
        if (!data) {
          // The order no longer exists on the server (e.g. deleted by an admin).
          removeOrder(entry.id)
          return null
        }
        const final = FINAL_STATUSES.includes(data.order.status)
        updateOrder(entry.id, {
          lastStatus: data.order.status,
          orderNumber: data.order.order_number,
          // Seeing it listed in Mis pedidos counts as having seen the outcome.
          ...(scope === 'all' && final ? { seenFinal: true } : {}),
        })
        return { entry: { ...entry, lastStatus: data.order.status }, data }
      }),
    )
    const fetched = new Map(results.filter(Boolean).map((r) => [r.entry.id, r]))
    // Use the freshest local entry (flags like seenFinal may have been set by
    // another view while this fetch was in flight), with the fetched data.
    setOrders(
      getOrderHistory()
        .map((entry) => ({ data: fetched.get(entry.id)?.data ?? null, entry }))
        .filter((r) => scope === 'all' || fetched.has(r.entry.id)),
    )
    setLoading(false)
    busy.current = false
  }, [scope])

  useEffect(() => {
    refresh()
    const tick = setInterval(() => {
      if (document.hidden) return
      const anyActive = getOrderHistory().some((e) => !FINAL_STATUSES.includes(e.lastStatus))
      if (anyActive) refresh()
    }, POLL_MS)
    const onVisible = () => !document.hidden && refresh()
    const onLocalChange = () => refresh()
    // Another view changed local flags (e.g. "seen"): re-read them, no network.
    const onLocalUpdate = () => {
      const latest = new Map(getOrderHistory().map((e) => [e.id, e]))
      setOrders((prev) =>
        prev.filter((r) => latest.has(r.entry.id)).map((r) => ({ ...r, entry: { ...r.entry, ...latest.get(r.entry.id) } })),
      )
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    window.addEventListener('rockyeats:orders-added', onLocalChange)
    window.addEventListener('rockyeats:orders-updated', onLocalUpdate)
    return () => {
      window.removeEventListener('rockyeats:orders-updated', onLocalUpdate)
      clearInterval(tick)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      window.removeEventListener('rockyeats:orders-added', onLocalChange)
    }
  }, [refresh])

  return { orders, loading, refresh }
}
