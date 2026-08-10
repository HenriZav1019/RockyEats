import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
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
  const { cart, total } = useCart()
  const { t } = useLanguage()

  const [restaurant, setRestaurant] = useState(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [deliveryStreet, setDeliveryStreet] = useState('')
  const [deliveryNumber, setDeliveryNumber] = useState('')
  const [deliveryBetweenStreets, setDeliveryBetweenStreets] = useState('')
  const [deliveryReference, setDeliveryReference] = useState('')
  const [deliveryIsHotelOrCondo, setDeliveryIsHotelOrCondo] = useState(false)
  const [deliveryUnitNumber, setDeliveryUnitNumber] = useState('')
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

  if (cart.restaurantId !== restaurantId || cart.items.length === 0) {
    return <Navigate to={`/r/${restaurantId}`} replace />
  }

  const availablePayments = restaurant ? PAYMENT_OPTIONS.filter((p) => restaurant[p.flag]) : []

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!cart.mode) {
      setError(t('checkout.noModeError'))
      return
    }

    setSubmitting(true)

    const orderId = crypto.randomUUID()

    const deliveryFields =
      cart.mode === 'delivery'
        ? {
            delivery_street: deliveryStreet,
            delivery_number: deliveryNumber,
            delivery_between_streets: deliveryBetweenStreets || null,
            delivery_reference: deliveryReference || null,
            delivery_is_hotel_or_condo: deliveryIsHotelOrCondo,
            delivery_unit_number: deliveryIsHotelOrCondo ? deliveryUnitNumber : null,
          }
        : {}

    const { error: orderError } = await supabase.from('orders').insert({
      id: orderId,
      restaurant_id: restaurantId,
      mode: cart.mode,
      payment_method: paymentMethod,
      customer_name: name,
      customer_phone: phone,
      total,
      ...deliveryFields,
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
      ...deliveryFields,
    }
    const orderItemsSnapshot = cart.items
    const restaurantSnapshot = restaurant

    navigate('/order-confirmation', {
      replace: true,
      state: { order, orderItems: orderItemsSnapshot, restaurant: restaurantSnapshot },
    })
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="font-display text-2xl font-bold text-ocean-900">{t('checkout.almostThere')}</h1>
      <p className="text-sm text-gray-500">{cart.restaurantName} · ${total.toFixed(2)}</p>

      {cart.mode ? (
        <p className="mt-1 text-sm text-gray-500">
          {t('cart.mode')}: <span className="font-medium text-gray-800">{t(`mode.${cart.mode}`)}</span>
        </p>
      ) : (
        <p className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {t('checkout.noModeError')}{' '}
          <Link to={`/r/${restaurantId}`} className="font-medium underline">
            {t('cart.keepBrowsing')}
          </Link>
        </p>
      )}

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

        {cart.mode === 'delivery' && (
          <div className="space-y-3 rounded-xl border border-sunset-100 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-gray-900">{t('checkout.deliveryAddress')}</p>
            <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-800">
              {t('checkout.deliveryFeeNote')}
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700" htmlFor="delivery-street">
                {t('checkout.street')}
              </label>
              <input
                id="delivery-street"
                required
                value={deliveryStreet}
                onChange={(e) => setDeliveryStreet(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-ocean-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700" htmlFor="delivery-number">
                {t('checkout.number')}
              </label>
              <input
                id="delivery-number"
                required
                value={deliveryNumber}
                onChange={(e) => setDeliveryNumber(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-ocean-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700" htmlFor="delivery-between">
                {t('checkout.betweenStreets')}
              </label>
              <input
                id="delivery-between"
                value={deliveryBetweenStreets}
                onChange={(e) => setDeliveryBetweenStreets(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-ocean-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700" htmlFor="delivery-reference">
                {t('checkout.reference')}
              </label>
              <textarea
                id="delivery-reference"
                value={deliveryReference}
                onChange={(e) => setDeliveryReference(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-ocean-500 focus:outline-none"
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={deliveryIsHotelOrCondo}
                onChange={(e) => setDeliveryIsHotelOrCondo(e.target.checked)}
              />
              {t('checkout.isHotelOrCondo')}
            </label>

            {deliveryIsHotelOrCondo && (
              <div>
                <label className="block text-sm font-medium text-gray-700" htmlFor="delivery-unit">
                  {t('checkout.unitNumber')}
                </label>
                <input
                  id="delivery-unit"
                  required
                  value={deliveryUnitNumber}
                  onChange={(e) => setDeliveryUnitNumber(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-ocean-500 focus:outline-none"
                />
              </div>
            )}
          </div>
        )}

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
                  {p.key === 'card_terminal' && restaurant?.card_terminal_mexican_cards_only && (
                    <span className="ml-1 text-gray-500">({t('payment.card_terminal.mexicanOnly')})</span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting || !paymentMethod || !cart.mode}
          className="w-full rounded-full bg-sunset-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-sunset-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? t('checkout.sending') : t('checkout.confirm')}
        </button>
      </form>
    </div>
  )
}

export default CheckoutPage
