import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../context/AuthContext.jsx'

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

function OrdersPage() {
  const { profile } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

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
          event: '*',
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
        <div key={order.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-gray-900">
                #{order.order_number} — {order.customer_name}
              </p>
              <p className="text-sm text-gray-500">
                {order.customer_phone} · {MODE_LABELS[order.mode]} · {PAYMENT_LABELS[order.payment_method]}
              </p>
            </div>
            <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_COLORS[order.status]}`}>
              {order.status}
            </span>
          </div>

          <ul className="mt-3 space-y-1 text-sm text-gray-700">
            {order.order_items.map((item) => (
              <li key={item.id}>
                {item.quantity}× {item.name_snapshot} — ${item.line_total}
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
