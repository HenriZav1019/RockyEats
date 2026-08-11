import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { playChime } from '../../lib/chime.js'

const NEW_ORDER_HIGHLIGHT_MS = 15000

const COLUMNS = [
  { statuses: ['submitted', 'confirmed'], nextStatus: 'preparing', title: '🆕 Nuevo', accent: 'border-sunset-400' },
  { statuses: ['preparing'], nextStatus: 'ready', title: '👨‍🍳 Preparando', accent: 'border-amber-400' },
  { statuses: ['ready'], nextStatus: 'completed', title: '✅ Listo — toca para marcar servido', accent: 'border-emerald-400' },
]

const MODE_ICONS = { dine_in: '🍽️', delivery: '🛵', pickup: '🥡' }
const MODE_LABELS = { dine_in: 'Come aquí', delivery: 'Entrega', pickup: 'Recoge en tienda' }
const PAYMENT_LABELS = { cash: 'Efectivo', transfer: 'Transferencia', card_terminal: 'Terminal / tarjeta' }

function deliveryAddressLines(order) {
  const lines = [`${order.delivery_street} #${order.delivery_number}`]
  if (order.delivery_between_streets) lines.push(`Entre calles: ${order.delivery_between_streets}`)
  if (order.delivery_is_hotel_or_condo) lines.push(`Hotel/condominio — habitación/unidad: ${order.delivery_unit_number}`)
  if (order.delivery_reference) lines.push(`Referencia: ${order.delivery_reference}`)
  return lines
}

function QueuePage() {
  const { profile } = useAuth()
  const [orders, setOrders] = useState([])
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [newOrderIds, setNewOrderIds] = useState(new Set())
  const hasLoadedOnce = useRef(false)

  const flagNewArrivals = (ids) => {
    if (ids.length === 0) return
    playChime()
    setNewOrderIds((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => next.add(id))
      return next
    })
    ids.forEach((id) => {
      setTimeout(() => {
        setNewOrderIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }, NEW_ORDER_HIGHLIGHT_MS)
    })
  }

  const fetchOrders = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select(
        'id, order_number, mode, status, customer_name, customer_phone, payment_method, total, order_items(*), delivery_street, delivery_number, delivery_between_streets, delivery_reference, delivery_is_hotel_or_condo, delivery_unit_number',
      )
      .eq('restaurant_id', profile.restaurant_id)
      .in('status', ['submitted', 'confirmed', 'preparing', 'ready'])
      .or('payment_confirmed.eq.true,payment_method.eq.card_terminal')
      .order('created_at', { ascending: true })

    const newList = data || []

    setOrders((prev) => {
      if (!hasLoadedOnce.current) {
        hasLoadedOnce.current = true
        return newList
      }
      const prevIds = new Set(prev.map((o) => o.id))
      const arrivedIds = newList.filter((o) => !prevIds.has(o.id)).map((o) => o.id)
      flagNewArrivals(arrivedIds)
      return newList
    })
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

  useEffect(() => {
    if (!selectedOrder) return
    const fresh = orders.find((o) => o.id === selectedOrder.id)
    setSelectedOrder(fresh || null)
  }, [orders, selectedOrder])

  const advance = async (order, nextStatus) => {
    setOrders((prev) => prev.filter((o) => o.id !== order.id || nextStatus !== 'completed'))
    setSelectedOrder(null)
    await supabase.from('orders').update({ status: nextStatus }).eq('id', order.id)
  }

  const nextStatusFor = (order) => COLUMNS.find((c) => c.statuses.includes(order.status))?.nextStatus

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
                  {MODE_ICONS[selectedOrder.mode]} {MODE_LABELS[selectedOrder.mode]} · {PAYMENT_LABELS[selectedOrder.payment_method]}
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

            <div className="mt-3 border-t border-white/10 pt-3">
              <p className="font-medium text-sand-50">{selectedOrder.customer_name}</p>
              <p className="text-sm text-sand-200">{selectedOrder.customer_phone}</p>
            </div>

            {selectedOrder.mode === 'delivery' && selectedOrder.delivery_street && (
              <div className="mt-3 border-t border-white/10 pt-3 text-sm text-sand-100">
                <p className="font-medium text-sand-50">📍 Dirección</p>
                {deliveryAddressLines(selectedOrder).map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            )}

            <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto border-t border-white/10 pt-3 text-sm">
              {selectedOrder.order_items.map((item) => (
                <li key={item.id} className="flex flex-col">
                  <span>
                    {item.quantity}× {item.name_snapshot} — ${item.line_total}
                  </span>
                  {item.notes && <span className="text-amber-300">⚠ {item.notes}</span>}
                </li>
              ))}
            </ul>

            <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
              <p className="font-semibold text-sand-50">Total: ${selectedOrder.total}</p>
              {nextStatusFor(selectedOrder) && (
                <button
                  type="button"
                  onClick={() => advance(selectedOrder, nextStatusFor(selectedOrder))}
                  className="rounded-full bg-ocean-600 px-4 py-2 text-sm font-semibold text-white hover:bg-ocean-700"
                >
                  Avanzar a {nextStatusFor(selectedOrder)}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default QueuePage
