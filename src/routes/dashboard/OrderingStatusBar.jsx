import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { DAY_LABELS_EN as DAY_LABELS, getOpenStatus, useNow } from '../../lib/hours.js'

function describe(status) {
  if (status.reason === 'paused') return 'Orders paused: customers can see your menu but can’t order.'
  if (status.open) {
    return status.closesAt ? `Taking orders · closes at ${status.closesAt}` : 'Taking orders'
  }
  if (!status.nextOpen) return 'Closed by your schedule (no opening hours set for this week).'
  const { daysAhead, dayKey, time } = status.nextOpen
  const when = daysAhead === 0 ? 'today' : daysAhead === 1 ? 'tomorrow' : DAY_LABELS[dayKey]
  return `Closed by your schedule · opens ${when} at ${time}`
}

// Shows whether customers can order right now, with a one-tap pause switch
// for when the kitchen is overwhelmed. Owners only (DashboardLayout routes
// station staff elsewhere).
function OrderingStatusBar({ restaurantId }) {
  const [restaurant, setRestaurant] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const now = useNow()

  useEffect(() => {
    supabase
      .from('restaurants')
      .select('opening_hours, orders_paused, timezone')
      .eq('id', restaurantId)
      .single()
      .then(({ data }) => setRestaurant(data || null))
  }, [restaurantId])

  if (!restaurant) return null

  const status = getOpenStatus(restaurant, now)
  const paused = restaurant.orders_paused

  const togglePause = async () => {
    setSaving(true)
    setError(null)
    const { error: updateError } = await supabase
      .from('restaurants')
      .update({ orders_paused: !paused })
      .eq('id', restaurantId)
    setSaving(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    setRestaurant((r) => ({ ...r, orders_paused: !paused }))
  }

  const tone = paused
    ? 'border-amber-300 bg-amber-50 text-amber-900'
    : status.open
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : 'border-gray-200 bg-gray-100 text-gray-700'

  return (
    <div className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 ${tone}`}>
      <p className="flex items-center gap-2 text-sm font-medium">
        <span
          aria-hidden="true"
          className={`h-2.5 w-2.5 rounded-full ${paused ? 'bg-amber-500' : status.open ? 'bg-emerald-500' : 'bg-gray-500'}`}
        />
        {describe(status)}
      </p>
      <button
        type="button"
        onClick={togglePause}
        disabled={saving}
        className={`rounded-md px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50 ${
          paused ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'
        }`}
      >
        {saving ? '…' : paused ? 'Resume orders' : 'Pause orders'}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </div>
  )
}

export default OrderingStatusBar
