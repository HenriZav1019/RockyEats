import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useCart } from '../../context/CartContext.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'
import { supabase } from '../../lib/supabase.js'

// This message goes TO the restaurant owner (a local Spanish-speaking business),
// so it always stays in Spanish regardless of the customer's chosen UI language.
const MODE_LABELS_ES = { dine_in: 'Aquí en el restaurante', delivery: 'A domicilio', pickup: 'Para recoger' }
const PAYMENT_LABELS_ES = { cash: 'Efectivo', transfer: 'Transferencia', card_terminal: 'Tarjeta (terminal)' }

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

  if (order.payment_method === 'transfer') {
    message += '\n\nLes enviaré mi comprobante de pago por aquí en un momento. 🙌'
  }

  return message
}

function OrderConfirmationPage() {
  const { state } = useLocation()
  const { t } = useLanguage()
  const { clearCart } = useCart()
  const [bank, setBank] = useState({})

  useEffect(() => {
    if (!state?.order) return
    clearCart()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.order?.id])

  useEffect(() => {
    if (state?.order?.payment_method !== 'transfer') return

    supabase
      .rpc('get_transfer_details', { p_order_id: state.order.id })
      .then(({ data }) => {
        if (data && data.length > 0) setBank(data[0])
      })
  }, [state])

  if (!state?.order) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-gray-600">{t('confirm.notFound')}</p>
        <Link to="/" className="mt-3 inline-block text-ocean-600 underline">
          {t('confirm.backHome')}
        </Link>
      </div>
    )
  }

  const { order, orderItems, restaurant } = state
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
