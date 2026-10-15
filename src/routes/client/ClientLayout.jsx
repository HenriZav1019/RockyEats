import { Link, Outlet, useLocation } from 'react-router-dom'
import { CircleCheck, CircleX, Clock, ReceiptText, ShoppingBag, X } from 'lucide-react'
import { useCart } from '../../context/CartContext.jsx'
import { LanguageProvider, useLanguage } from '../../context/LanguageContext.jsx'
import LanguagePicker from '../../components/LanguagePicker.jsx'
import wordmark from '../../assets/rockyeats-wordmark-tight.webp'
import { FINAL_STATUSES, updateOrder } from '../../lib/orderHistory.js'
import { useMyOrders } from '../../lib/useMyOrders.js'
import { formatMoney } from '../../lib/format.js'

// Slim bar under the header that follows the customer's latest order.
function OrderBanner({ result, t, onDismiss }) {
  const { entry, data } = result
  const status = data.order.status
  const number = data.order.order_number
  const done = status === 'completed'
  const cancelled = status === 'cancelled'
  const tone = done ? 'bg-tide-500 text-white' : cancelled ? 'bg-chili-500 text-white' : 'bg-sun-500 text-white'
  const Icon = done ? CircleCheck : cancelled ? CircleX : Clock
  const text = done
    ? t('banner.delivered').replace('{n}', number)
    : cancelled
      ? t('banner.cancelled').replace('{n}', number)
      : `${t('banner.activeOrder')} #${number}: ${t(`confirm.status.${status}`)}`
  return (
    <div role="status" className={tone}>
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5 text-sm">
        <Icon size={18} strokeWidth={2.5} className="shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 font-semibold">{text}</span>
        <Link
          to={done || cancelled ? '/my-orders' : `/order-confirmation/${entry.id}`}
          onClick={done || cancelled ? onDismiss : undefined}
          className="shrink-0 font-bold underline underline-offset-2"
        >
          {done || cancelled ? t('banner.myOrders') : t('banner.viewOrder')}
        </Link>
        {(done || cancelled) && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label={t('banner.dismiss')}
            className="-mr-2 grid h-8 w-8 shrink-0 place-items-center rounded-full hover:bg-white/15"
          >
            <X size={17} />
          </button>
        )}
      </div>
    </div>
  )
}

function ClientLayoutInner() {
  const { cart, itemCount, total } = useCart()
  const { language, setLanguage, t } = useLanguage()
  const location = useLocation()
  const { orders: myOrders, refresh: refreshMyOrders } = useMyOrders('active')

  if (!language) return <LanguagePicker />

  const onConfirmation = location.pathname.startsWith('/order-confirmation/')
  // Banner priority: the newest order still in progress; otherwise a finished
  // order the customer hasn't seen yet ("¡Tu pedido fue entregado!").
  const notHere = (r) => location.pathname !== `/order-confirmation/${r.entry.id}`
  const finishedUnseen = myOrders.find(
    (r) => r.data && FINAL_STATUSES.includes(r.data.order.status) && !r.entry.seenFinal && notHere(r),
  )
  const inProgress = myOrders.find((r) => r.data && !FINAL_STATUSES.includes(r.data.order.status) && notHere(r))
  const banner = inProgress || finishedUnseen
  const dismissBanner = (id) => {
    updateOrder(id, { seenFinal: true })
    refreshMyOrders()
  }
  // Menu, cart and checkout have their own bottom bar with the cart, so the
  // header pill would be a duplicate there.
  const pageHasCartBar = /^\/r\/[^/]+(\/cart|\/checkout)?$/.test(location.pathname)

  return (
    <div className="flex min-h-screen flex-col bg-salt text-sea-950">
      <header className="sticky top-0 z-30 bg-sea-950 text-white">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-2 px-4">
          <Link to="/" aria-label="RockyEats" className="-ml-1 flex shrink-0 items-center rounded-md p-1">
            <img src={wordmark} alt="RockyEats" className="h-8 w-auto" width="520" height="165" />
          </Link>

          <nav className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}
              aria-label={language === 'es' ? 'Switch to English' : 'Cambiar a español'}
              className="h-10 rounded-full px-3 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              {language === 'es' ? 'EN' : 'ES'}
            </button>
            <Link
              to="/my-orders"
              aria-label={t('nav.myOrders')}
              title={t('nav.myOrders')}
              className="grid h-10 w-10 place-items-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              <ReceiptText size={21} strokeWidth={2} />
            </Link>
            {itemCount > 0 && !pageHasCartBar && !onConfirmation && (
              <Link
                to={`/r/${cart.restaurantId}/cart`}
                className="ml-1 flex h-10 items-center gap-2 rounded-full bg-sun-500 pl-3 pr-4 text-sm font-bold text-white transition hover:bg-sun-600"
              >
                <ShoppingBag size={18} strokeWidth={2.25} />
                <span className="tabular-nums">{formatMoney(total)}</span>
              </Link>
            )}
          </nav>
        </div>
      </header>

      {banner && (
        <OrderBanner
          result={banner}
          t={t}
          onDismiss={() => dismissBanner(banner.entry.id)}
        />
      )}

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className={`bg-sea-950 px-4 pb-10 pt-8 text-sm text-white/60 ${pageHasCartBar ? 'hidden' : ''}`}>
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          <img src={wordmark} alt="" className="h-7 w-auto self-start opacity-90" width="520" height="165" />
          <p>{t('footer.tagline')}</p>
          <Link to="/my-orders" className="self-start font-semibold text-white/80 underline underline-offset-2">
            {t('nav.myOrders')}
          </Link>
        </div>
      </footer>
    </div>
  )
}

function ClientLayout() {
  return (
    <LanguageProvider>
      <ClientLayoutInner />
    </LanguageProvider>
  )
}

export default ClientLayout
