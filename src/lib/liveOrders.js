import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase.js'

// Keeps a staff screen current: Supabase Realtime for instant updates, plus a
// polling backstop, plus an immediate refresh when the screen comes back into
// view (phones and tablets pause background tabs).
//
// Each table gets its OWN channel on purpose. Supabase joins all listeners of
// a channel as one unit: if the server refuses one (for example order_items
// before it's added to the realtime publication), the whole channel fails and
// even `orders` events stop arriving.
//
// Returns 'live' | 'connecting' | 'polling' so the screen can show whether
// it's truly live.
const POLL_LIVE_MS = 20000
const POLL_FALLBACK_MS = 8000

export function useLiveOrders({ restaurantId, onChange, itemEvents = 'UPDATE' }) {
  const [mode, setMode] = useState('connecting')
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!restaurantId) return undefined
    const refresh = () => onChangeRef.current?.()
    const states = { orders: 'connecting', order_items: 'connecting' }
    const update = () => {
      // Orders is what matters for "a new order arrived"; items only refine it.
      setMode(states.orders === 'live' ? 'live' : states.orders === 'connecting' ? 'connecting' : 'polling')
    }
    const watch = (table, binding) => {
      const ch = supabase
        .channel(`${table}-${restaurantId}-${Math.random().toString(36).slice(2, 8)}`)
        .on('postgres_changes', binding, refresh)
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') states[table] = 'live'
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            states[table] = 'down'
            if (err) console.warn(`[realtime] ${table}: ${status}`, err.message || err)
          }
          update()
        })
      return ch
    }

    const channels = [
      watch('orders', { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` }),
      watch('order_items', { event: itemEvents, schema: 'public', table: 'order_items' }),
    ]

    let timer
    const schedule = () => {
      clearTimeout(timer)
      const ms = states.orders === 'live' ? POLL_LIVE_MS : POLL_FALLBACK_MS
      timer = setTimeout(() => {
        if (!document.hidden) refresh()
        schedule()
      }, ms)
    }
    schedule()

    const onVisible = () => {
      if (!document.hidden) refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    window.addEventListener('online', onVisible)

    return () => {
      clearTimeout(timer)
      channels.forEach((ch) => supabase.removeChannel(ch))
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      window.removeEventListener('online', onVisible)
    }
  }, [restaurantId, itemEvents])

  return mode
}
