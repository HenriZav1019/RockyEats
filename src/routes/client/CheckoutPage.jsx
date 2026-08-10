import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { useCart } from '../../context/CartContext.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'

const PAYMENT_OPTIONS = [
  { key: 'cash', flag: 'accepts_cash', icon: '💵' },
  { key: 'transfer', flag: 'accepts_transfer', icon: '🏦' },
  { key: 'card_terminal', flag: 'accepts_card_terminal', icon: '💳' },
]

function CheckoutPage() {
  const { restaurantId } = useParams()
  const navigate = useNavigate()
  const { cart, total, clearCart } = useCart()
  const { t } = useLanguage()

  const [restaurant, setRestaurant] = useState(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    supabase
      .from('restaurants')
      .select('*')
      .eq('id', restaurantId)
      .single()
      .then(({ data }) => setRestaurant(data || null))
  }, [restaurantId])

  if (cart.restaurantId !== restaurantId || cart.items.length === 0 || !cart.mode) {
    return <Navigate to={`/r/${restaurantId}`} replace />
  }

  const availablePayments = restaurant ? PAYMENT_OPTIONS.filter((p) => restaurant[p.flag]) : []

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const orderId = crypto.randomUUID()

    const { error: orderError } = await supabase.from('orders').insert({
      id: orderId,
      restaurant_id: restaurantId,
      mode: cart.mode,
      payment_method: paymentMethod,
      customer_name: name,
      customer_phone: phone,
      total,
    })

    if (orderError) {
      setSubmitting(false)
      setError(orderError.message)
      return
    }

    const { error: itemsError } = await supabase.from('order_items').insert(
      cart.items.map((item) => ({
        order_id: orderId,
        menu_item_id: item.id,
        name_snapshot: item.name,
        price_snapshot: item.price,
        station_snapshot: item.station || 'kitchen',
        quantity: item.quantity,
        notes: item.notes || null,
      })),
    )

    if (itemsError) {
      setSubmitting(false)
      setError(itemsError.message)
      return
    }

    const { data: orderNumber } = await supabase.rpc('get_order_number', { p_order_id: orderId })

    setSubmitting(false)

    const order = {
      id: orderId,
      order_number: orderNumber,
      mode: cart.mode,
      payment_method: paymentMethod,
      customer_name: name,
      customer_phone: phone,
      total,
    }
    const orderItemsSnapshot = cart.items
    const restaurantSnapshot = restaurant

    navigate('/order-confirmation', {
      replace: true,
      state: { order, orderItems: orderItemsSnapshot, restaurant: restaurantSnapshot },
    })
    clearCart()
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="font-display text-2xl font-bold text-ocean-900">{t('checkout.almostThere')}</h1>
      <p className="text-sm text-gray-500">{cart.restaurantName} · ${total.toFixed(2)}</p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-5">
        <div className="space-y-3 rounded-xl border border-sunset-100 bg-white p-4 shadow-sm">
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="name">
              {t('checkout.name')}
            </label>
            <input
              id="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-ocean-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="phone">
              {t('checkout.phone')}
            </label>
            <input
              id="phone"
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-ocean-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="rounded-xl border border-sunset-100 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-gray-900">{t('checkout.howToPay')}</p>
          <div className="mt-3 space-y-2">
            {availablePayments.map((p) => (
              <label
                key={p.key}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition ${
                  paymentMethod === p.key
                    ? 'border-ocean-500 bg-ocean-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  value={p.key}
                  checked={paymentMethod === p.key}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="accent-ocean-600"
                />
                <span>
                  {p.icon} <span className="font-medium text-gray-900">{t(`payment.${p.key}`)}</span>
                  <span className="ml-1 text-gray-500">— {t(`payment.${p.key}.hint`)}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting || !paymentMethod}
          className="w-full rounded-full bg-sunset-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-sunset-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? t('checkout.sending') : t('checkout.confirm')}
        </button>
      </form>
    </div>
  )
}

export default CheckoutPage
