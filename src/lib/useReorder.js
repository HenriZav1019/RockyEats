import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabase.js'
import { useCart } from '../context/CartContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'

const MODE_FLAG = { dine_in: 'supports_dine_in', delivery: 'supports_delivery', pickup: 'supports_pickup' }

// Refills the cart from a past order (data = get_order_confirmation shape)
// using TODAY's menu: current prices, sold-out or removed dishes left out.
// Then opens the cart so the customer can review before checking out.
export function useReorder() {
  const navigate = useNavigate()
  const { cart, replaceCart } = useCart()
  const { t } = useLanguage()
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState(null)

  const reorder = async (data) => {
    const { order, order_items: lines, restaurant } = data
    const restaurantId = order.restaurant_id || restaurant?.id
    setError(null)

    if (cart.items.length > 0) {
      const from = cart.restaurantName || restaurant?.name || ''
      if (!window.confirm(t('reorder.replaceCart').replace('{from}', from))) return
    }

    setBusyId(order.id)
    const ids = [...new Set(lines.map((l) => l.menu_item_id).filter(Boolean))]
    const [{ data: r }, { data: menu }] = await Promise.all([
      supabase.from('restaurants').select('id, name, is_active, supports_dine_in, supports_delivery, supports_pickup').eq('id', restaurantId).maybeSingle(),
      ids.length
        ? supabase.from('menu_items').select('id, name, price, available, station').eq('restaurant_id', restaurantId).in('id', ids)
        : Promise.resolve({ data: [] }),
    ])
    setBusyId(null)

    const byId = new Map((menu || []).map((m) => [m.id, m]))
    const items = []
    const missing = []
    for (const line of lines) {
      const m = line.menu_item_id && byId.get(line.menu_item_id)
      if (!m || !m.available || !r?.is_active) {
        missing.push(line.name)
        continue
      }
      const existing = items.find((i) => i.id === m.id)
      if (existing) existing.quantity = Math.min(99, existing.quantity + line.quantity)
      else
        items.push({
          id: m.id,
          name: m.name,
          price: Number(m.price),
          station: m.station || 'kitchen',
          quantity: line.quantity,
          notes: line.notes || '',
        })
    }

    if (items.length === 0) {
      setError({ orderId: order.id, message: t('reorder.noneLeft') })
      return
    }

    replaceCart({
      restaurantId,
      restaurantName: r.name,
      mode: r[MODE_FLAG[order.mode]] ? order.mode : null,
      items,
    })
    navigate(`/r/${restaurantId}/cart`, { state: { reorderMissing: missing } })
  }

  return { reorder, busyId, error }
}
