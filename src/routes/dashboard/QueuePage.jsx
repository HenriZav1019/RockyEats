import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../context/AuthContext.jsx'

const COLUMNS = [
  { statuses: ['submitted', 'confirmed'], nextStatus: 'preparing', title: '🆕 Nuevo', accent: 'border-sunset-400' },
  { statuses: ['preparing'], nextStatus: 'ready', title: '👨‍🍳 Preparando', accent: 'border-amber-400' },
  { statuses: ['ready'], nextStatus: 'completed', title: '✅ Listo — toca para marcar servido', accent: 'border-emerald-400' },
]

const MODE_ICONS = { dine_in: '🍽️', delivery: '🛵', pickup: '🥡' }

function QueuePage() {
  const { profile } = useAuth()
  const [orders, setOrders] = useState([])

  const fetchOrders = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select('id, order_number, mode, status, customer_name')
      .eq('restaurant_id', profile.restaurant_id)
      .in('status', ['submitted', 'confirmed', 'preparing', 'ready'])
      .order('created_at', { ascending: true })

    setOrders(data || [])
  }, [profile.restaurant_id])

  useEffect(() => {
    fetchOrders()

    const channel = supabase
      .channel('queue-orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${profile.restaurant_id}`,
        },
        () => fetchOrders(),
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [fetchOrders, profile.restaurant_id])

  const advance = async (order, nextStatus) => {
    setOrders((prev) => prev.filter((o) => o.id !== order.id || nextStatus !== 'completed'))
    await supabase.from('orders').update({ status: nextStatus }).eq('id', order.id)
  }

  return (
    <div className="rounded-2xl bg-dusk-900 p-4 sm:p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {COLUMNS.map((col) => {
          const columnOrders = orders.filter((o) => col.statuses.includes(o.status))

          return (
            <div key={col.title} className={`rounded-2xl border-t-4 bg-dusk-800 p-4 ${col.accent}`}>
              <h2 className="font-display text-lg font-bold text-sand-100">{col.title}</h2>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {columnOrders.map((order) => (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => advance(order, col.nextStatus)}
                    className="flex flex-col items-center justify-center rounded-xl bg-dusk-700 py-4 text-sand-50 shadow-md transition hover:scale-105 hover:bg-ocean-700 active:scale-95"
                  >
                    <span className="font-display text-3xl font-extrabold tracking-wide">
                      {order.order_number}
                    </span>
                    <span className="mt-1 text-xs text-sand-200">
                      {MODE_ICONS[order.mode]} {order.customer_name}
                    </span>
                  </button>
                ))}

                {columnOrders.length === 0 && (
                  <p className="col-span-full py-4 text-center text-sm text-sand-200/50">—</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default QueuePage
