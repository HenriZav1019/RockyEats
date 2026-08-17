import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useCart } from '../../context/CartContext.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'
import { supabase } from '../../lib/supabase.js'
import { removePendingOrder } from '../../lib/pendingOrders.js'

const TERMINAL_STATUSES = ['completed', 'cancelled']

// This message goes TO the restaurant owner (a local Spanish-speaking business),
// so it always stays in Spanish regardless of the customer's chosen UI language.
const MODE_LABELS_ES = { dine_in: 'Aquí en el restaurante', delivery: 'A domicilio', pickup: 'Para recoger' }
const PAYMENT_LABELS_ES = { cash: 'Efectivo', transfer: 'Transferencia', card_terminal: 'Tarjeta (terminal)' }

function buildDeliveryAddressLines(order) {
  const lines = [`${order.delivery_street} #${order.delivery_number}`]
  if (order.delivery_between_streets) lines.push(`Entre calles: ${order.delivery_between_streets}`)
  if (order.delivery_is_hotel_or_condo) lines.push(`Hotel/condominio — habitación/unidad: ${order.delivery_unit_number}`)
  if (order.delivery_reference) lines.push(`Referencia: ${order.delivery_reference}`)
  return lines
}

function buildWhatsAppMessage(order, orderItems, total, restaurantName) {
  const itemLines = orderItems
    .map((i) => `• ${i.quantity}x ${i.name}${i.notes ? ` (${i.notes})` : ''}`)
    .join('\n')
  let message =
    `🌮 ¡Nuevo pedido en ${restaurantName}! #${order.order_number}\n` +
    `Cliente: ${order.customer_name} (${order.customer_phone})\n` +
    `Modo: ${MODE_LABELS_ES[order.mode]}\n` +
    `Pago: ${PAYMENT_LABELS_ES[order.payment_method]}\n\n` +
    `${itemLines}\n\n` +
    `Total: $${total.toFixed(2)}`

  if (order.mode === 'delivery' && order.delivery_street) {
    message += `\n\n📍 Dirección:\n${buildDeliveryAddressLines(order).join('\n')}`
  }

  if (order.payment_method === 'transfer') {
    message += '\n\nLes enviaré mi comprobante de pago por aquí en un momento. 🙌'
  }

  return message
}

function OrderConfirmationPage() {
  const { orderId } = useParams()
  const { state } = useLocation()
  const { t } = useLanguage()
  const { clearCart } = useCart()
  const [bank, setBank] = useState({})
  const [fetched, setFetched] = useState(null)
  const [loading, setLoading] = useState(false)

  const hasFreshState = state?.order?.id === orderId

  useEffect(() => {
    if (!hasFreshState) return
    clearCart()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasFreshState])

  // Fallback path: router state is gone (app was closed and reopened, tab
  // reloaded, link opened fresh) — re-fetch everything from the order id in
  // the URL instead of showing "order not found".
  useEffect(() => {
    if (hasFreshState || !orderId) return
    let active = true
    setLoading(true)

    supabase
      .rpc('get_order_confirmation', { p_order_id: orderId })
      .then(({ data, error }) => {
        if (!active) return
        setLoading(false)
        if (error || !data) return
        setFetched({
          order: data.order,
          orderItems: data.order_items,
          restaurant: data.restaurant,
        })
      })

    return () => {
      active = false
    }
  }, [orderId, hasFreshState])

  const resolved = hasFreshState ? state : fetched

  useEffect(() => {
    const status = resolved?.order?.status
    const id = resolved?.order?.id
    if (id && TERMINAL_STATUSES.includes(status)) removePendingOrder(id)
  }, [resolved?.order?.id, resolved?.order?.status])

  useEffect(() => {
    if (resolved?.order?.payment_method !== 'transfer') return

    supabase
      .rpc('get_transfer_details', { p_order_id: resolved.order.id })
      .then(({ data }) => {
        if (data && data.length > 0) setBank(data[0])
      })
  }, [resolved?.order?.id, resolved?.order?.payment_method])

  if (loading) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center text-gray-500">
        {t('confirm.loading')}
      </div>
    )
  }

  if (!resolved?.order) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-gray-600">{t('confirm.notFound')}</p>
        <Link to="/track-order" className="mt-3 inline-block text-ocean-600 underline">
          {t('track.title')}
        </Link>
        <br />
        <Link to="/" className="mt-2 inline-block text-ocean-600 underline">
          {t('confirm.backHome')}
        </Link>
      </div>
    )
  }

  const { order, orderItems, restaurant } = resolved
  const status = order.status || 'submitted'
  const total = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0)

  const whatsappUrl =
    restaurant?.whatsapp_enabled && restaurant?.whatsapp_number
      ? `https://wa.me/${restaurant.whatsapp_number.replace(/\D/g, '')}?text=${encodeURIComponent(
          buildWhatsAppMessage(order, orderItems, total, restaurant.name),
        )}`
      : null

  return (
    <div className="relative mx-auto max-w-lg overflow-hidden px-4 py-10">
      <span className="animate-float absolute -left-2 top-6 text-4xl opacity-60" aria-hidden="true">
        🌊
      </span>
      <span
        className="animate-float absolute -right-2 top-24 text-4xl opacity-60"
        style={{ animationDelay: '1.2s' }}
        aria-hidden="true"
      >
        🌅
      </span>

      <div className="animate-pop-in relative rounded-2xl border border-sunset-100 bg-gradient-to-b from-white to-sunset-50 p-6 text-center shadow-md">
        <p className="text-5xl">🎉</p>
        <h1 className="mt-2 font-display text-2xl font-bold text-ocean-900">{t('confirm.orderConfirmed')}</h1>
        <p className="mt-1 text-gray-500">{restaurant?.name}</p>

        <p className="mt-4 font-display text-5xl font-extrabold tracking-wide text-sunset-600">
          #{order.order_number}
        </p>

        <p className="mt-2 inline-block rounded-full bg-ocean-100 px-3 py-1 text-xs font-semibold text-ocean-800">
          {t('confirm.statusLabel')}: {t(`confirm.status.${status}`)}
        </p>

        <p className="mt-3 text-sm text-gray-600">{t(`confirm.mode.${order.mode}`)}</p>
      </div>

      {whatsappUrl ? (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          className="animate-fade-up mt-4 flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-4 py-4 text-base font-semibold text-white shadow-md transition hover:scale-[1.02] hover:bg-emerald-600 active:scale-95"
          style={{ animationDelay: '0.2s' }}
        >
          {t('confirm.notifyWhatsApp')}
        </a>
      ) : (
        <p className="animate-fade-up mt-4 text-center text-sm text-gray-500" style={{ animationDelay: '0.2s' }}>
          {t('confirm.callInstead')}{order.order_number}.
        </p>
      )}

      <div
        className="animate-fade-up mt-4 rounded-2xl border border-sunset-100 bg-white p-4 shadow-sm"
        style={{ animationDelay: '0.3s' }}
      >
        <p className="text-sm font-semibold text-gray-900">{t('confirm.yourOrder')}</p>
        <ul className="mt-2 space-y-1 text-sm text-gray-700">
          {orderItems.map((item) => (
            <li key={item.id} className="flex justify-between">
              <span>
                {item.quantity}× {item.name}
                {item.notes && <span className="block text-xs text-gray-400">{item.notes}</span>}
              </span>
              <span>${(item.price * item.quantity).toFixed(2)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex justify-between border-t border-gray-100 pt-2 font-semibold text-gray-900">
          <span>{t('cart.total')}</span>
          <span>${total.toFixed(2)}</span>
        </div>
      </div>

      {order.mode === 'delivery' && order.delivery_street && (
        <div
          className="animate-fade-up mt-4 rounded-2xl border border-sunset-100 bg-white p-4 shadow-sm"
          style={{ animationDelay: '0.35s' }}
        >
          <p className="text-sm font-semibold text-gray-900">{t('checkout.deliveryAddress')}</p>
          <ul className="mt-2 space-y-1 text-sm text-gray-700">
            {buildDeliveryAddressLines(order).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      {order.payment_method === 'transfer' && (
        <div
          className="animate-fade-up mt-4 rounded-2xl border border-ocean-200 bg-ocean-50 p-4 shadow-sm"
          style={{ animationDelay: '0.4s' }}
        >
          <p className="text-sm font-semibold text-ocean-900">{t('confirm.transferDetails')}</p>
          <dl className="mt-2 space-y-1 text-sm text-ocean-900">
            {bank.bank_name && (
              <div className="flex justify-between">
                <dt>{t('confirm.bank')}</dt>
                <dd className="font-medium">{bank.bank_name}</dd>
              </div>
            )}
            {bank.account_holder && (
              <div className="flex justify-between">
                <dt>{t('confirm.accountHolder')}</dt>
                <dd className="font-medium">{bank.account_holder}</dd>
              </div>
            )}
            {bank.clabe && (
              <div className="flex justify-between">
                <dt>{t('confirm.clabe')}</dt>
                <dd className="font-medium">{bank.clabe}</dd>
              </div>
            )}
            {bank.notes && <p className="pt-1 text-ocean-700">{bank.notes}</p>}
          </dl>
          <p className="mt-3 text-xs text-ocean-700">{t('confirm.afterTransfer')}</p>
        </div>
      )}

      <Link
        to="/"
        className="mt-6 block text-center text-sm font-medium text-ocean-700 hover:underline"
      >
        ← {t('confirm.backHome')}
      </Link>
    </div>
  )
}

export default OrderConfirmationPage
