import { Link } from 'react-router-dom'
import { ChevronRight, CircleCheck, CircleX, Search } from 'lucide-react'
import { useLanguage } from '../../context/LanguageContext.jsx'
import { FINAL_STATUSES } from '../../lib/orderHistory.js'
import { useMyOrders } from '../../lib/useMyOrders.js'
import { formatMoney } from '../../lib/format.js'
import ModeIcon from '../../components/ModeIcon.jsx'
import { BackLink, PageTitle } from '../../components/ui.jsx'

const STEPS = ['submitted', 'confirmed', 'preparing', 'ready']

function itemsSummary(items) {
  const text = items.map((i) => `${i.quantity}× ${i.name}`).join(', ')
  return text.length > 70 ? `${text.slice(0, 68)}…` : text
}

function ActiveCard({ data, t }) {
  const { order, order_items: items, restaurant } = data
  const step = STEPS.indexOf(order.status)
  return (
    <Link
      to={`/order-confirmation/${order.id}`}
      className="block overflow-hidden rounded-2xl bg-sea-950 p-4 text-white transition active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white/65">{restaurant?.name}</p>
          <p className="condensed text-[2.5rem] font-extrabold leading-none">{order.order_number}</p>
        </div>
        <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-sm font-bold">
          <ModeIcon mode={order.mode} size={15} />
          {t(`confirm.status.${order.status}`)}
        </span>
      </div>
      <ol className="mt-4 grid grid-cols-4 gap-1" aria-label={t('confirm.statusLabel')}>
        {STEPS.map((s, i) => (
          <li key={s} className={`h-1.5 rounded-full ${i <= step ? 'bg-tide-500' : 'bg-white/20'}`} />
        ))}
      </ol>
      <p className="mt-3 flex items-center justify-between gap-3 text-sm text-white/75">
        <span className="truncate">{itemsSummary(items)}</span>
        <span className="flex shrink-0 items-center gap-1 font-bold text-white">
          {formatMoney(items.reduce((s, i) => s + i.price * i.quantity, 0))}
          <ChevronRight size={17} aria-hidden="true" />
        </span>
      </p>
    </Link>
  )
}

function PastRow({ data, t, language }) {
  const { order, order_items: items, restaurant } = data
  const done = order.status === 'completed'
  const date = new Date(order.created_at).toLocaleDateString(language === 'en' ? 'en-US' : 'es-MX', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
  return (
    <li>
      <Link to={`/order-confirmation/${order.id}`} className="flex items-center gap-3 py-3.5 transition hover:bg-sea-950/[0.03]">
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${done ? 'bg-tide-100 text-tide-500' : 'bg-chili-500/10 text-chili-500'}`}
        >
          {done ? <CircleCheck size={20} strokeWidth={2.25} aria-hidden="true" /> : <CircleX size={20} strokeWidth={2.25} aria-hidden="true" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-3">
            <span className="truncate font-bold">{restaurant?.name}</span>
            <span className="shrink-0 font-bold tabular-nums">{formatMoney(items.reduce((s, i) => s + i.price * i.quantity, 0))}</span>
          </span>
          <span className="block truncate text-sm text-sea-950/60">{itemsSummary(items)}</span>
          <span className="mt-0.5 block text-xs font-semibold text-sea-950/50">
            #{order.order_number} · {done ? t('myOrders.delivered') : t('myOrders.cancelled')} · {date}
          </span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-sea-950/30" aria-hidden="true" />
      </Link>
    </li>
  )
}

function MyOrdersPage() {
  const { t, language } = useLanguage()
  const { orders, loading } = useMyOrders('all')
  const withData = orders.filter((r) => r.data)
  const active = withData.filter((r) => !FINAL_STATUSES.includes(r.data.order.status))
  const past = withData.filter((r) => FINAL_STATUSES.includes(r.data.order.status))

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-3">
      <BackLink to="/">{t('menu.back')}</BackLink>
      <PageTitle sub={t('myOrders.subtitle')}>{t('myOrders.title')}</PageTitle>

      {loading && withData.length === 0 ? (
        <div className="mt-6 space-y-3" aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-sea-950/[0.06]" />
          ))}
        </div>
      ) : withData.length === 0 ? (
        <div className="mt-8 rounded-2xl border-2 border-dashed border-sea-950/15 px-6 py-10 text-center">
          <p className="text-lg font-bold">{t('myOrders.empty')}</p>
          <Link to="/" className="mt-4 inline-block rounded-full bg-sun-500 px-5 py-2.5 text-sm font-bold text-white">
            {t('myOrders.browse')}
          </Link>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <section className="mt-6">
              <h2 className="mb-3 text-lg font-bold">{t('myOrders.inProgress')}</h2>
              <div className="space-y-3">
                {active.map((r) => (
                  <ActiveCard key={r.entry.id} data={r.data} t={t} />
                ))}
              </div>
            </section>
          )}
          {past.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-1 text-lg font-bold">{t('myOrders.previous')}</h2>
              <ul className="divide-y divide-sea-950/10">
                {past.map((r) => (
                  <PastRow key={r.entry.id} data={r.data} t={t} language={language} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <Link
        to="/track-order"
        className="mt-10 flex items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-sea-950/10 transition hover:ring-sea-950/25"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-salt">
          <Search size={18} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold">{t('myOrders.otherPhone')}</span>
          <span className="block text-sm text-sea-950/60">{t('myOrders.otherPhoneSub')}</span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-sea-950/30" aria-hidden="true" />
      </Link>
    </div>
  )
}

export default MyOrdersPage
