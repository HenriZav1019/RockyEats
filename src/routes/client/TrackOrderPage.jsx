import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { useLanguage } from '../../context/LanguageContext.jsx'
import { addPendingOrder } from '../../lib/pendingOrders.js'

function TrackOrderPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [orderNumber, setOrderNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const { data, error: rpcError } = await supabase.rpc('lookup_order_by_number_and_phone', {
      p_order_number: orderNumber.trim(),
      p_phone: phone.trim(),
    })

    setSubmitting(false)

    if (rpcError || !data) {
      setError(t('track.notFound'))
      return
    }

    addPendingOrder({
      id: data.order.id,
      orderNumber: data.order.order_number,
      restaurantId: data.order.restaurant_id,
      restaurantName: data.restaurant?.name || '',
    })

    navigate(`/order-confirmation/${data.order.id}`, {
      state: { order: data.order, orderItems: data.order_items, restaurant: data.restaurant },
    })
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="font-display text-2xl font-bold text-ocean-900">{t('track.title')}</h1>
      <p className="mt-1 text-sm text-gray-500">{t('track.subtitle')}</p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4 rounded-xl border border-sunset-100 bg-white p-4 shadow-sm">
        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="order-number">
            {t('track.orderNumber')}
          </label>
          <input
            id="order-number"
            required
            placeholder="A1234"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm uppercase focus:border-ocean-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="track-phone">
            {t('track.phone')}
          </label>
          <input
            id="track-phone"
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-ocean-500 focus:outline-none"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-sunset-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-sunset-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? t('track.searching') : t('track.find')}
        </button>
      </form>
    </div>
  )
}

export default TrackOrderPage
