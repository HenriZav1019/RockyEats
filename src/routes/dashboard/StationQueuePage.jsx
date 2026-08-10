import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { playChime } from '../../lib/chime.js'

const NEW_ORDER_HIGHLIGHT_MS = 15000

const MODE_ICONS = { dine_in: '🍽️', delivery: '🛵', pickup: '🥡' }
const MODE_LABELS = { dine_in: 'Come aquí', delivery: 'Entrega', pickup: 'Recoge en tienda' }

const STATION_LABELS = { bar: '🍹 Bar', kitchen: '👨‍🍳 Kitchen' }

function StationQueuePage({ station }) {
  const { profile } = useAuth()
  const [orders, setOrders] = useState([])
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [newOrderIds, setNewOrderIds] = useState(new Set())

  const fetchOrders = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select('id, order_number, mode, status, customer_name, order_items(*)')
      .eq('restaurant_id', profile.restaurant_id)
      .in('status', ['submitted', 'confirmed', 'preparing', 'ready'])
      .order('created_at', { ascending: true })

    const relevant = (data || [])
      .map((o) => ({ ...o, order_items: o.order_items.filter((i) => i.station_snapshot === station) }))
      .filter((o) => o.order_items.length > 0)

    setOrders(relevant)
  }, [profile.restaurant_id, station])

  useEffect(() => {
    fetchOrders()

    const channel = supabase
      .channel(`station-queue-${station}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${profile.restaurant_id}` },
        () => fetchOrders(),
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_items' }, (payload) => {
        if (payload.new.station_snapshot !== station) {
          fetchOrders()
          return
        }
        playChime()
        const orderId = payload.new.order_id
        setNewOrderIds((prev) => new Set(prev).add(orderId))
        setTimeout(() => {
          setNewOrderIds((prev) => {
            const next = new Set(prev)
            next.delete(orderId)
            return next
          })
        }, NEW_ORDER_HIGHLIGHT_MS)
        fetchOrders()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'order_items' }, () => fetchOrders())
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [fetchOrders, profile.restaurant_id, station])

  useEffect(() => {
    if (!selectedOrder) return
    const fresh = orders.find((o) => o.id === selectedOrder.id)
    setSelectedOrder(fresh || null)
  }, [orders, selectedOrder])

  const markItemReady = async (item, itemStatus) => {
    setOrders((prev) =>
      prev.map((o) => ({
        ...o,
        order_items: o.order_items.map((i) => (i.id === item.id ? { ...i, item_status: itemStatus } : i)),
      })),
    )
    await supabase.from('order_items').update({ item_status: itemStatus }).eq('id', item.id)
  }

  const isOrderReady = (order) => order.order_items.every((i) => i.item_status === 'ready')

  const pending = orders.filter((o) => !isOrderReady(o))
  const ready = orders.filter((o) => isOrderReady(o))

  const columns = [
    { title: '🆕 Pending', accent: 'border-sunset-400', list: pending },
    { title: '✅ Ready', accent: 'border-emerald-400', list: ready },
  ]

  return (
    <div className="rounded-2xl bg-dusk-900 p-4 sm:p-6">
      <h1 className="mb-4 font-display text-xl font-bold text-sand-100">{STATION_LABELS[station]} queue</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {columns.map((col) => (
          <div key={col.title} className={`rounded-2xl border-t-4 bg-dusk-800 p-4 ${col.accent}`}>
            <h2 className="font-display text-lg font-bold text-sand-100">{col.title}</h2>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {col.list.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => setSelectedOrder(order)}
                  className={`relative flex flex-col items-center justify-center rounded-xl bg-dusk-700 py-4 text-sand-50 shadow-md transition hover:scale-105 hover:bg-ocean-700 active:scale-95 ${
                    newOrderIds.has(order.id) ? 'animate-pulse ring-2 ring-sunset-400' : ''
                  }`}
                >
                  {newOrderIds.has(order.id) && (
                    <span className="absolute -top-2 -right-2 rounded-full bg-sunset-500 px-2 py-0.5 text-[10px] font-bold text-white">
                      NEW
                    </span>
                  )}
                  <span className="font-display text-3xl font-extrabold tracking-wide">{order.order_number}</span>
                  <span className="mt-1 text-xs text-sand-200">
                    {MODE_ICONS[order.mode]} {order.customer_name}
                  </span>
                </button>
              ))}

              {col.list.length === 0 && <p className="col-span-full py-4 text-center text-sm text-sand-200/50">—</p>}
            </div>
          </div>
        ))}
      </div>

      {selectedOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setSelectedOrder(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-dusk-800 p-5 text-sand-50 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-2xl font-extrabold">{selectedOrder.order_number}</p>
                <p className="text-sm text-sand-200">
                  {MODE_ICONS[selectedOrder.mode]} {MODE_LABELS[selectedOrder.mode]} · {selectedOrder.customer_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="rounded-full bg-dusk-700 px-2.5 py-1 text-sm text-sand-200 hover:bg-dusk-700/70"
              >
                ✕
              </button>
            </div>

            <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto border-t border-white/10 pt-3 text-sm">
              {selectedOrder.order_items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2">
                  <div>
                    <span>
                      {item.quantity}× {item.name_snapshot}
                    </span>
                    {item.notes && <span className="ml-1 text-amber-300">⚠ {item.notes}</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => markItemReady(item, item.item_status === 'ready' ? 'pending' : 'ready')}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                      item.item_status === 'ready'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-dusk-700 text-sand-200 hover:bg-ocean-700'
                    }`}
                  >
                    {item.item_status === 'ready' ? 'Ready ✓' : 'Mark ready'}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

export default StationQueuePage
