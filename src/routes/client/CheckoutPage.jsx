import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Banknote, Check, CreditCard, Landmark } from 'lucide-react'
import { supabase } from '../../lib/supabase.js'
import { useCart } from '../../context/CartContext.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'
import { addPendingOrder } from '../../lib/pendingOrders.js'
import { placeOrder, TURNSTILE_SITE_KEY } from '../../lib/placeOrder.js'
import TurnstileWidget from '../../components/TurnstileWidget.jsx'
import { getOpenStatus, useNow } from '../../lib/hours.js'
import { formatMoney } from '../../lib/format.js'
import ModeIcon from '../../components/ModeIcon.jsx'
import { BackLink, BottomBar, Field, Notice, PageTitle, PrimaryButton, SectionTitle, inputClass } from '../../components/ui.jsx'

const PAYMENT_OPTIONS = [
  { key: 'cash', flag: 'accepts_cash' },
  { key: 'transfer', flag: 'accepts_transfer' },
  { key: 'card_terminal', flag: 'accepts_card_terminal' },
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
    if (!paymentMethod) {
      setError(t('checkout.pickPayment'))
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

  const payIcons = { cash: Banknote, transfer: Landmark, card_terminal: CreditCard }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-32 pt-3">
      <BackLink to={`/r/${restaurantId}/cart`}>{t('cart.title')}</BackLink>
      <PageTitle sub={cart.restaurantName}>{t('checkout.almostThere')}</PageTitle>

      {cart.mode ? (
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-semibold ring-1 ring-sea-950/10">
          <ModeIcon mode={cart.mode} size={16} />
          {t(`mode.${cart.mode}.badge`)}
        </p>
      ) : (
        <div className="mt-4">
          <Notice tone="error">
            {t('checkout.noModeError')}{' '}
            <Link to={`/r/${restaurantId}`} className="underline">
              {t('cart.keepBrowsing')}
            </Link>
          </Notice>
        </div>
      )}

      <form id="checkout-form" onSubmit={handleSubmit} className="mt-6 space-y-8">
        <section>
          <SectionTitle>{t('checkout.yourDetails')}</SectionTitle>
          <div className="space-y-4">
            <Field id="name" label={t('checkout.name')}>
              <input id="name" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
            </Field>
            <Field id="phone" label={t('checkout.phone')} hint={t('checkout.phoneHint')}>
              <input
                id="phone"
                type="tel"
                required
                autoComplete="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        </section>

        {cart.mode === 'delivery' && (
          <section>
            <SectionTitle>{t('checkout.deliveryAddress')}</SectionTitle>
            <div className="space-y-4">
              <div className="grid grid-cols-[1fr_6.5rem] gap-3">
                <Field id="delivery-street" label={t('checkout.street')}>
                  <input id="delivery-street" required autoComplete="address-line1" value={deliveryStreet} onChange={(e) => setDeliveryStreet(e.target.value)} className={inputClass} />
                </Field>
                <Field id="delivery-number" label={t('checkout.number')}>
                  <input id="delivery-number" required value={deliveryNumber} onChange={(e) => setDeliveryNumber(e.target.value)} className={inputClass} />
                </Field>
              </div>
              <Field id="delivery-between" label={t('checkout.betweenStreets')} optional optionalLabel={t('checkout.optional')}>
                <input id="delivery-between" value={deliveryBetweenStreets} onChange={(e) => setDeliveryBetweenStreets(e.target.value)} className={inputClass} />
              </Field>
              <Field id="delivery-reference" label={t('checkout.reference')} optional optionalLabel={t('checkout.optional')} hint={t('checkout.referenceHint')}>
                <textarea
                  id="delivery-reference"
                  value={deliveryReference}
                  onChange={(e) => setDeliveryReference(e.target.value)}
                  rows={2}
                  className={`${inputClass} h-auto py-3`}
                />
              </Field>
              <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl bg-white px-3.5 ring-1 ring-sea-950/15">
                <input
                  type="checkbox"
                  checked={deliveryIsHotelOrCondo}
                  onChange={(e) => setDeliveryIsHotelOrCondo(e.target.checked)}
                  className="h-5 w-5 accent-sea-950"
                />
                <span className="text-sm font-semibold">{t('checkout.isHotelOrCondo')}</span>
              </label>
              {deliveryIsHotelOrCondo && (
                <Field id="delivery-unit" label={t('checkout.unitNumber')}>
                  <input id="delivery-unit" required value={deliveryUnitNumber} onChange={(e) => setDeliveryUnitNumber(e.target.value)} className={inputClass} />
                </Field>
              )}
              <Notice tone="warn">{t('checkout.deliveryFeeNote')}</Notice>
            </div>
          </section>
        )}

        <section>
          <SectionTitle>{t('checkout.howToPay')}</SectionTitle>
          <div role="radiogroup" aria-label={t('checkout.howToPay')} className="space-y-2.5">
            {availablePayments.map((p) => {
              const Icon = payIcons[p.key]
              const selected = paymentMethod === p.key
              return (
                <label
                  key={p.key}
                  className={`flex cursor-pointer items-center gap-3.5 rounded-2xl bg-white p-4 transition ${
                    selected ? 'ring-2 ring-sea-950' : 'ring-1 ring-sea-950/15 hover:ring-sea-950/30'
                  }`}
                >
                  <input
                    type="radio"
                    name="payment"
                    value={p.key}
                    checked={selected}
                    onChange={(e) => {
                      setPaymentMethod(e.target.value)
                      setError(null)
                    }}
                    className="sr-only"
                  />
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${selected ? 'bg-sea-950 text-white' : 'bg-salt text-sea-950'}`}>
                    <Icon size={22} strokeWidth={2} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{t(`payment.${p.key}`)}</span>
                    <span className="block text-sm text-sea-950/60">
                      {t(`payment.${p.key}.hint`)}
                      {p.key === 'card_terminal' && restaurant?.card_terminal_mexican_cards_only && `. ${t('payment.card_terminal.mexicanOnly')}`}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${selected ? 'bg-sea-950 text-white' : 'ring-2 ring-sea-950/20'}`}
                  >
                    {selected && <Check size={15} strokeWidth={3} />}
                  </span>
                </label>
              )
            })}
          </div>
        </section>

        <section>
          <SectionTitle>{t('checkout.summary')}</SectionTitle>
          <ul className="space-y-1.5 text-sm">
            {cart.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-3">
                <span>
                  <span className="font-semibold tabular-nums">{item.quantity}×</span> {item.name}
                  {item.notes && <span className="block text-sea-950/55">{item.notes}</span>}
                </span>
                <span className="tabular-nums">{formatMoney(item.price * item.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-baseline justify-between border-t-2 border-sea-950 pt-3">
            <span className="font-bold">{t('cart.total')}</span>
            <span className="condensed text-2xl font-extrabold tabular-nums">{formatMoney(total)}</span>
          </div>
        </section>

        <div className="space-y-3">
          {!openStatus.open && (
            <Notice>{openStatus.reason === 'paused' ? t('hours.pausedBanner') : t('hours.closedBanner')}</Notice>
          )}
          {cartNotice && <Notice tone="warn">{cartNotice}</Notice>}
          {needsTurnstile && (
            <TurnstileWidget ref={turnstileRef} siteKey={TURNSTILE_SITE_KEY} language={language} onToken={setTurnstileToken} />
          )}
          {error && (
            <div role="alert">
              <Notice tone="error">{error}</Notice>
            </div>
          )}
        </div>

        <BottomBar>
          <PrimaryButton type="submit" disabled={submitting || !cart.mode || !openStatus.open}>
            <span>{submitting ? t('checkout.sending') : t('checkout.confirm')}</span>
            <span className="tabular-nums">{formatMoney(total)}</span>
          </PrimaryButton>
        </BottomBar>
      </form>
    </div>
  )
}

export default CheckoutPage
