import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { Check, Copy, MapPin, MessageCircle, Phone } from 'lucide-react'
import { useCart } from '../../context/CartContext.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'
import { supabase } from '../../lib/supabase.js'
import { removePendingOrder } from '../../lib/pendingOrders.js'
import { formatMoney } from '../../lib/format.js'
import ModeIcon from '../../components/ModeIcon.jsx'
import { Notice, SectionTitle } from '../../components/ui.jsx'

const POLL_MS = 20000
const STEPS = ['submitted', 'confirmed', 'preparing', 'ready']

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

function ProgressSteps({ status, t }) {
  const current = STEPS.indexOf(status === 'completed' ? 'ready' : status)
  return (
    <ol className="grid grid-cols-4 gap-1" aria-label={t('confirm.statusLabel')}>
      {STEPS.map((step, i) => {
        const done = i <= current
        const now = i === current
        return (
          <li key={step} className="flex flex-col gap-2" aria-current={now ? 'step' : undefined}>
            <span className={`h-1.5 rounded-full ${done ? 'bg-tide-500' : 'bg-white/20'} ${now && status !== 'completed' ? 'animate-pulse' : ''}`} />
            <span className={`text-xs font-semibold leading-tight ${done ? 'text-white' : 'text-white/45'}`}>
              {t(`confirm.status.${step}`)}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function CopyButton({ value, t }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } catch {
          // Clipboard blocked: the number is still visible to copy by hand.
        }
      }}
      className="inline-flex h-9 items-center gap-1.5 rounded-full bg-sea-950 px-3 text-sm font-semibold text-white"
    >
      {copied ? <Check size={15} strokeWidth={2.5} /> : <Copy size={15} strokeWidth={2.25} />}
      {copied ? t('confirm.copied') : t('confirm.copy')}
    </button>
  )
}

function OrderConfirmationPage() {
  const { orderId } = useParams()
  const { state } = useLocation()
  const { t } = useLanguage()
  const { clearCart } = useCart()
  const [bank, setBank] = useState({})
  const [fetched, setFetched] = useState(null)
  const [loading, setLoading] = useState(false)
  const [liveStatus, setLiveStatus] = useState(null)

  const hasFreshState = state?.order?.id === orderId

  useEffect(() => {
    if (!hasFreshState) return
    clearCart()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasFreshState])

  // Fallback path: router state is gone (app was closed and reopened, tab
  // reloaded, link opened fresh), so re-fetch everything from the order id.
  useEffect(() => {
    if (hasFreshState || !orderId) return
    let active = true
    setLoading(true)
    supabase.rpc('get_order_confirmation', { p_order_id: orderId }).then(({ data, error }) => {
      if (!active) return
      setLoading(false)
      if (error || !data) return
      setFetched({ order: data.order, orderItems: data.order_items, restaurant: data.restaurant })
    })
    return () => {
      active = false
    }
  }, [orderId, hasFreshState])

  const resolved = hasFreshState ? state : fetched
  const status = liveStatus || resolved?.order?.status || 'submitted'

  // Keep the tracker current while the customer waits.
  useEffect(() => {
    if (!resolved?.order?.id || TERMINAL_STATUSES.includes(status)) return
    const id = setInterval(async () => {
      if (document.hidden) return
      const { data } = await supabase.rpc('get_order_confirmation', { p_order_id: resolved.order.id })
      if (data?.order?.status) setLiveStatus(data.order.status)
    }, POLL_MS)
    return () => clearInterval(id)
  }, [resolved?.order?.id, status])

  useEffect(() => {
    const id = resolved?.order?.id
    if (id && TERMINAL_STATUSES.includes(status)) removePendingOrder(id)
  }, [resolved?.order?.id, status])

  useEffect(() => {
    if (resolved?.order?.payment_method !== 'transfer') return
    supabase.rpc('get_transfer_details', { p_order_id: resolved.order.id }).then(({ data }) => {
      if (data && data.length > 0) setBank(data[0])
    })
  }, [resolved?.order?.id, resolved?.order?.payment_method])

  if (loading) {
    return (
      <div aria-busy="true" className="bg-sea-950 px-4 py-16 text-center text-white/70">
        {t('confirm.loading')}
      </div>
    )
  }

  if (!resolved?.order) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-sea-950/70">{t('confirm.notFound')}</p>
        <div className="mt-5 flex justify-center gap-3">
          <Link to="/track-order" className="rounded-full bg-sea-950 px-5 py-2.5 text-sm font-semibold text-white">
            {t('track.title')}
          </Link>
          <Link to="/" className="rounded-full px-5 py-2.5 text-sm font-semibold ring-1 ring-sea-950/20">
            {t('confirm.backHome')}
          </Link>
        </div>
      </div>
    )
  }

  const { order, orderItems, restaurant } = resolved
  const total = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const whatsappUrl =
    restaurant?.whatsapp_enabled && restaurant?.whatsapp_number
      ? `https://wa.me/${restaurant.whatsapp_number.replace(/\D/g, '')}?text=${encodeURIComponent(
          buildWhatsAppMessage(order, orderItems, total, restaurant.name),
        )}`
      : null
  const cancelled = status === 'cancelled'

  return (
    <div className="pb-12">
      <section className="bg-sea-950 text-white">
        <div className="mx-auto max-w-3xl px-4 pb-24 pt-8">
          <p className="text-sm font-semibold text-white/65">{restaurant?.name}</p>
          <h1 className="condensed mt-1 text-[2.6rem] font-extrabold leading-[0.95]">{t(`confirm.headline.${status}`)}</h1>
          {!cancelled && (
            <div className="mt-6">
              <ProgressSteps status={status} t={t} />
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto -mt-16 max-w-3xl space-y-8 px-4">
        {/* The ticket: what the customer shows the server or the counter. */}
        <div
          className="relative rounded-3xl bg-white px-5 pb-5 pt-6 shadow-[0_12px_32px_-12px_rgba(8,32,45,0.45)]"
          style={{
            WebkitMaskImage: 'radial-gradient(circle 14px at 0 62%, transparent 13px, #000 14px), radial-gradient(circle 14px at 100% 62%, transparent 13px, #000 14px)',
            WebkitMaskComposite: 'source-in',
            maskImage: 'radial-gradient(circle 14px at 0 62%, transparent 13px, #000 14px), radial-gradient(circle 14px at 100% 62%, transparent 13px, #000 14px)',
            maskComposite: 'intersect',
          }}
        >
          <p className="text-sm font-semibold text-sea-950/60">{t('confirm.yourNumber')}</p>
          <p className="condensed text-[5.5rem] font-extrabold leading-[0.85] tracking-tight text-sea-950">
            {order.order_number}
          </p>
          <div className="mt-6 border-t-2 border-dashed border-sea-950/15 pt-4">
            <p className="flex items-center gap-2 text-sm font-bold">
              <ModeIcon mode={order.mode} size={17} />
              {t(`mode.${order.mode}.badge`)}
            </p>
            <p className="mt-1 text-sm text-sea-950/70">{t(`confirm.mode.${order.mode}`)}</p>
          </div>
        </div>

        {cancelled && <Notice tone="error">{t('confirm.cancelledHelp')}</Notice>}

        {whatsappUrl ? (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="flex h-14 items-center justify-center gap-2.5 rounded-2xl bg-[#1fa855] text-base font-bold text-white transition hover:bg-[#1a9149]"
          >
            <MessageCircle size={21} strokeWidth={2.25} aria-hidden="true" />
            {t('confirm.notifyWhatsApp')}
          </a>
        ) : (
          <Notice>
            <Phone size={15} className="mr-1.5 inline" aria-hidden="true" />
            {t('confirm.callInstead')}
            {order.order_number}.
          </Notice>
        )}

        {order.payment_method === 'transfer' && (
          <section>
            <SectionTitle>{t('confirm.transferDetails')}</SectionTitle>
            <div className="rounded-2xl bg-white p-4 ring-1 ring-sea-950/10">
              <dl className="space-y-3 text-sm">
                {bank.bank_name && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-sea-950/60">{t('confirm.bank')}</dt>
                    <dd className="font-semibold">{bank.bank_name}</dd>
                  </div>
                )}
                {bank.account_holder && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-sea-950/60">{t('confirm.accountHolder')}</dt>
                    <dd className="text-right font-semibold">{bank.account_holder}</dd>
                  </div>
                )}
                {bank.clabe && (
                  <div>
                    <dt className="text-sea-950/60">{t('confirm.clabe')}</dt>
                    <dd className="mt-1 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-lg font-bold tracking-wide tabular-nums">{bank.clabe}</span>
                      <CopyButton value={bank.clabe} t={t} />
                    </dd>
                  </div>
                )}
                <div className="flex justify-between gap-3 border-t border-sea-950/10 pt-3">
                  <dt className="text-sea-950/60">{t('confirm.amount')}</dt>
                  <dd className="font-bold tabular-nums">{formatMoney(total)}</dd>
                </div>
              </dl>
            </div>
            <p className="mt-2 text-sm text-sea-950/65">{t('confirm.afterTransfer')}</p>
          </section>
        )}

        <section>
          <SectionTitle>{t('confirm.yourOrder')}</SectionTitle>
          <ul className="space-y-2 text-sm">
            {orderItems.map((item) => (
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
          {order.mode === 'delivery' && order.delivery_street && (
            <div className="mt-5 flex gap-2.5 text-sm">
              <MapPin size={17} strokeWidth={2.25} className="mt-0.5 shrink-0" aria-hidden="true" />
              <ul className="space-y-0.5">
                {buildDeliveryAddressLines(order).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <Link to="/" className="block text-center text-sm font-semibold text-sea-950/65 underline underline-offset-2">
          {t('confirm.backHome')}
        </Link>
      </div>
    </div>
  )
}

export default OrderConfirmationPage
