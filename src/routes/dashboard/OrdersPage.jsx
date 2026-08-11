import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { playChime } from '../../lib/chime.js'

const NEW_ORDER_HIGHLIGHT_MS = 15000

const STATUSES = ['submitted', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled']

const STATUS_COLORS = {
  submitted: 'bg-blue-100 text-blue-800',
  confirmed: 'bg-indigo-100 text-indigo-800',
  preparing: 'bg-amber-100 text-amber-800',
  ready: 'bg-emerald-100 text-emerald-800',
  completed: 'bg-gray-200 text-gray-700',
  cancelled: 'bg-red-100 text-red-800',
}

const MODE_LABELS = { dine_in: "I'm here", delivery: 'Deliver to me', pickup: "I'll pick it up" }
const PAYMENT_LABELS = { cash: 'Cash', transfer: 'Transfer', card_terminal: 'Card terminal' }

function deliveryAddressLines(order) {
  const lines = [`${order.delivery_street} #${order.delivery_number}`]
  if (order.delivery_between_streets) lines.push(`Between: ${order.delivery_between_streets}`)
  if (order.delivery_is_hotel_or_condo) lines.push(`Hotel/condo — room/unit: ${order.delivery_unit_number}`)
  if (order.delivery_reference) lines.push(`Reference: ${order.delivery_reference}`)
  return lines
}

function OrdersPage() {
  const { profile } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [newOrderIds, setNewOrderIds] = useState(new Set())

  const fetchOrders = useCallback(async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('restaurant_id', profile.restaurant_id)
      .order('created_at', { ascending: false })

    if (!error) setOrders(data)
    setLoading(false)
  }, [profile.restaurant_id])

  useEffect(() => {
    fetchOrders()

    const channel = supabase
      .channel('dashboard-orders')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${profile.restaurant_id}`,
        },
        (payload) => {
          playChime()
          const orderId = payload.new.id
          setNewOrderIds((prev) => new Set(prev).add(orderId))
          setTimeout(() => {
            setNewOrderIds((prev) => {
              const next = new Set(prev)
              next.delete(orderId)
              return next
            })
          }, NEW_ORDER_HIGHLIGHT_MS)
          fetchOrders()
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${profile.restaurant_id}`,
        },
        () => fetchOrders(),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchOrders, profile.restaurant_id])

  const updateStatus = async (orderId, status) => {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)))
    await supabase.from('orders').update({ status }).eq('id', orderId)
  }

  const togglePaymentConfirmed = async (orderId, current) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, payment_confirmed: !current } : o)),
    )
    await supabase.from('orders').update({ payment_confirmed: !current }).eq('id', orderId)
  }

  if (loading) return <p className="text-gray-500">Loading orders…</p>

  if (orders.length === 0) {
    return <p className="text-gray-500">No orders yet.</p>
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <div
          key={order.id}
          className={`rounded-lg border bg-white p-4 shadow-sm ${
            newOrderIds.has(order.id)
              ? 'animate-pulse border-sunset-400 ring-2 ring-sunset-400'
              : 'border-gray-200'
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-gray-900">
                {newOrderIds.has(order.id) && (
                  <span className="mr-2 rounded-full bg-sunset-500 px-2 py-0.5 text-xs font-bold text-white">
                    NEW
                  </span>
                )}
                #{order.order_number} — {order.customer_name}
              </p>
              <p className="text-sm text-gray-500">
                {order.customer_phone} · {MODE_LABELS[order.mode]} · {PAYMENT_LABELS[order.payment_method]}
              </p>
              {order.mode === 'delivery' && order.delivery_street && (
                <p className="mt-1 text-sm text-gray-700">
                  📍{' '}
                  {deliveryAddressLines(order).map((line, i) => (
                    <span key={line}>
                      {i > 0 && ' · '}
                      {line}
                    </span>
                  ))}
                </p>
              )}
            </div>
            <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_COLORS[order.status]}`}>
              {order.status}
            </span>
          </div>

          <ul className="mt-3 space-y-1 text-sm text-gray-700">
            {order.order_items.map((item) => (
              <li key={item.id}>
                {item.quantity}× {item.name_snapshot} — ${item.line_total}
                {item.notes && (
                  <span className="ml-1 font-medium text-amber-700">⚠ {item.notes}</span>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3">
            <p className="font-medium text-gray-900">Total: ${order.total}</p>

            <div className="flex items-center gap-3">
              {order.payment_method !== 'card_terminal' && (
                <label className="flex items-center gap-1.5 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={order.payment_confirmed}
                    onChange={() => togglePaymentConfirmed(order.id, order.payment_confirmed)}
                  />
                  Payment received
                </label>
              )}

              <select
                value={order.status}
                onChange={(e) => updateStatus(order.id, e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1 text-sm"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default OrdersPage
