import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { PackageSearch, ShoppingBag } from 'lucide-react'
import { useCart } from '../../context/CartContext.jsx'
import { LanguageProvider, useLanguage } from '../../context/LanguageContext.jsx'
import LanguagePicker from '../../components/LanguagePicker.jsx'
import wordmark from '../../assets/rockyeats-wordmark-tight.webp'
import { supabase } from '../../lib/supabase.js'
import { getActivePendingOrders, removePendingOrder } from '../../lib/pendingOrders.js'
import { formatMoney } from '../../lib/format.js'

const TERMINAL_STATUSES = ['completed', 'cancelled']

function ClientLayoutInner() {
  const { cart, itemCount, total } = useCart()
  const { language, setLanguage, t } = useLanguage()
  const location = useLocation()
  const [activeOrder, setActiveOrder] = useState(null)

  useEffect(() => {
    const pending = getActivePendingOrders()
    const latest = pending[pending.length - 1]
    if (!latest) return
    let active = true
    supabase.rpc('get_order_confirmation', { p_order_id: latest.id }).then(({ data }) => {
      if (!active) return
      if (!data || TERMINAL_STATUSES.includes(data.order.status)) {
        removePendingOrder(latest.id)
        return
      }
      setActiveOrder({ id: latest.id, orderNumber: data.order.order_number })
    })
    return () => {
      active = false
    }
  }, [])

  if (!language) return <LanguagePicker />

  const onConfirmation = location.pathname.startsWith('/order-confirmation/')
  const showBanner = activeOrder && location.pathname !== `/order-confirmation/${activeOrder.id}`
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
              to="/track-order"
              aria-label={t('nav.trackOrder')}
              title={t('nav.trackOrder')}
              className="grid h-10 w-10 place-items-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              <PackageSearch size={21} strokeWidth={2} />
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

      {showBanner && (
        <Link
          to={`/order-confirmation/${activeOrder.id}`}
          className="block bg-tide-500 text-white transition hover:bg-tide-500/90"
        >
          <span className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <span>
              {t('banner.activeOrder')} <strong className="font-bold">#{activeOrder.orderNumber}</strong>
            </span>
            <span className="font-semibold underline underline-offset-2">{t('banner.viewOrder')}</span>
          </span>
        </Link>
      )}

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className={`bg-sea-950 px-4 pb-10 pt-8 text-sm text-white/60 ${pageHasCartBar ? 'hidden' : ''}`}>
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          <img src={wordmark} alt="" className="h-7 w-auto self-start opacity-90" width="520" height="165" />
          <p>{t('footer.tagline')}</p>
          <Link to="/track-order" className="self-start font-semibold text-white/80 underline underline-offset-2">
            {t('nav.trackOrder')}
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
