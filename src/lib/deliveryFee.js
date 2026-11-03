import { useEffect, useState } from 'react'
import { supabase } from './supabase.js'
import { formatMoney } from './format.js'

// restaurants.delivery_fee: null = not set (the driver tells the customer and
// collects it), 0 = free delivery, > 0 = fixed fee added to the order total.
export function deliveryFeeFor(restaurant, mode) {
  if (mode !== 'delivery' || !restaurant) return { known: true, fee: 0 }
  const raw = restaurant.delivery_fee
  if (raw === null || raw === undefined) return { known: false, fee: 0 }
  return { known: true, fee: Number(raw) }
}

// Text for the "Envío" line: "$35.00", "Gratis" or "Se paga al repartidor".
export function feeLabel({ known, fee }, t) {
  if (!known) return t('fee.byDriver')
  return fee === 0 ? t('fee.free') : formatMoney(fee)
}

// For pages that only have the restaurant id (the cart).
export function useRestaurantFeeRow(restaurantId) {
  const [row, setRow] = useState(null)
  useEffect(() => {
    if (!restaurantId) return
    let alive = true
    supabase
      .from('restaurants')
      .select('delivery_fee')
      .eq('id', restaurantId)
      .single()
      .then(({ data }) => alive && setRow(data || null))
    return () => {
      alive = false
    }
  }, [restaurantId])
  return row
}
