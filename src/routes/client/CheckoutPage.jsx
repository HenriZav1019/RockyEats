import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { useCart } from '../../context/CartContext.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'
import { addPendingOrder } from '../../lib/pendingOrders.js'
import { placeOrder, TURNSTILE_SITE_KEY } from '../../lib/placeOrder.js'
import TurnstileWidget from '../../components/TurnstileWidget.jsx'
import { getOpenStatus, useNow } from '../../lib/hours.js'

const PAYMENT_OPTIONS = [
  { key: 'cash', flag: 'accepts_cash', icon: '💵' },
  { key: 'transfer', flag: 'accepts_transfer', icon: '🏦' },
  { key: 'card_terminal', flag: 'accepts_card_terminal', icon: '💳' },
]

function CheckoutPage() {
  const { restaurantId } = useParams()
  const navigate = useNavigate()
  const { cart, total, syncWithMenu } = useCart()
  const { language, t } = useLanguage()
  const turnstileRef = useRef(null)
  const now = useNow()

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
  const [turnstileToken, setTurnstileToken] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [cartNotice, setCartNotice] = useState(null)

  useEffect(() => {
    supabase
      .from('restaurants')
      .select('*')
      .eq('id', restaurantId)
      .single()
      .then(({ data }) => setRestaurant(data || null))
  }, [restaurantId])

  // Re-checks the cart against the live menu (prices, sold-out items) and
  // tells the customer if anything changed since they added it.
  const refreshCartFromMenu = async () => {
    const ids = cart.items.map((i) => i.id)
    if (ids.length === 0) return
    const { data } = await supabase
      .from('menu_items')
      .select('id, name, price, available, station')
      .eq('restaurant_id', restaurantId)
      .in('id', ids)
    if (!data) return
    const { removed, repriced } = syncWithMenu(data)
    const notices = []
    if (removed.length > 0) notices.push(`${t('checkout.itemsRemoved')} ${removed.join(', ')}`)
    if (repriced.length > 0) notices.push(`${t('checkout.pricesUpdated')} ${repriced.join(', ')}`)
    setCartNotice(notices.length > 0 ? notices.join(' · ') : null)
  }

  useEffect(() => {
    refreshCartFromMenu()
    // Only on arrival at checkout; later refreshes happen after a failed submit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId])

  if (cart.restaurantId !== restaurantId || cart.items.length === 0) {
    return <Navigate to={`/r/${restaurantId}`} replace />
  }

  const availablePayments = restaurant ? PAYMENT_OPTIONS.filter((p) => restaurant[p.flag]) : []
  const needsTurnstile = Boolean(TURNSTILE_SITE_KEY)
  // Until the restaurant row loads, assume open; the database refuses closed orders anyway.
  const openStatus = restaurant ? getOpenStatus(restaurant, now) : { open: true }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!cart.mode) {
      setError(t('checkout.noModeError'))
      return
    }
    if (needsTurnstile && !turnstileToken) {
      setError(t('error.RE_CAPTCHA_FAILED'))
      return
    }

    setSubmitting(true)

    const result = await placeOrder(
      {
        p_restaurant_id: restaurantId,
        p_mode: cart.mode,
        p_payment_method: paymentMethod,
        p_customer_name: name,
        p_customer_phone: phone,
        p_items: cart.items.map((item) => ({
          menu_item_id: item.id,
          quantity: item.quantity,
          notes: item.notes || null,
        })),
        p_delivery:
          cart.mode === 'delivery'
            ? {
                street: deliveryStreet,
                number: deliveryNumber,
                between_streets: deliveryBetweenStreets || null,
                reference: deliveryReference || null,
                is_hotel_or_condo: deliveryIsHotelOrCondo,
                unit_number: deliveryIsHotelOrCondo ? deliveryUnitNumber : null,
              }
            : null,
        p_expected_total: Math.round(total * 100) / 100,
      },
      turnstileToken,
    )

    if (!result.data) {
      setSubmitting(false)
      // Turnstile tokens are single-use, so get a fresh one for the retry.
      turnstileRef.current?.reset()
      if (result.code === 'RE_ITEM_UNAVAILABLE' || result.code === 'RE_PRICE_CHANGED') {
        await refreshCartFromMenu()
      }
      setError(t(`error.${result.code}`))
      return
    }

    const { order, order_items: orderItems, restaurant: orderRestaurant } = result.data

    addPendingOrder({
      id: order.id,
      orderNumber: order.order_number,
      restaurantId,
      restaurantName: orderRestaurant?.name || cart.restaurantName,
    })

    navigate(`/order-confirmation/${order.id}`, {
      replace: true,
      state: { order, orderItems, restaurant: { ...restaurant, ...orderRestaurant } },
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

        {!openStatus.open && (
          <p className="rounded-lg bg-gray-100 p-3 text-sm font-medium text-gray-700">
            {openStatus.reason === 'paused' ? t('hours.pausedBanner') : t('hours.closedBanner')}
          </p>
        )}

        {cartNotice && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{cartNotice}</p>
        )}

        {needsTurnstile && (
          <TurnstileWidget
            ref={turnstileRef}
            siteKey={TURNSTILE_SITE_KEY}
            language={language}
            onToken={setTurnstileToken}
          />
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={
            submitting || !paymentMethod || !cart.mode || !openStatus.open || (needsTurnstile && !turnstileToken)
          }
          className="w-full rounded-full bg-sunset-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-sunset-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? t('checkout.sending') : t('checkout.confirm')}
        </button>
      </form>
    </div>
  )
}

export default CheckoutPage
