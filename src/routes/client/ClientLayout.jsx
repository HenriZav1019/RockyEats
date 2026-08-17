import { Link, Outlet } from 'react-router-dom'
import { useCart } from '../../context/CartContext.jsx'
import { LanguageProvider, useLanguage } from '../../context/LanguageContext.jsx'
import LanguagePicker from '../../components/LanguagePicker.jsx'
import logo from '../../assets/rockyeats-logo.png'
import wordmark from '../../assets/rockyeats-wordmark-header.png'

function ClientLayoutInner() {
  const { cart, itemCount, total } = useCart()
  const { language, setLanguage, t } = useLanguage()

  if (!language) return <LanguagePicker />

  return (
    <div className="relative flex min-h-screen flex-col bg-sand-50">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-sunset-300/40 blur-3xl" />
        <div className="absolute -right-20 top-1/3 h-80 w-80 rounded-full bg-ocean-300/40 blur-3xl" />
        <div className="absolute -bottom-24 left-1/4 h-96 w-96 rounded-full bg-coral-400/25 blur-3xl" />
        <img
          src={logo}
          alt=""
          className="absolute -right-16 bottom-0 h-[420px] w-[420px] rotate-6 object-cover opacity-[0.07] blur-2xl"
        />
      </div>

      <header className="sticky top-0 z-20 border-b border-black/20 bg-ocean-900 shadow-lg shadow-black/20">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-3 sm:px-4">
          <Link to="/" className="flex items-center py-3">
            <img src={wordmark} alt="RockyEats" className="h-8 w-auto sm:h-10" />
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}
              className="rounded-full border border-white/25 px-3 py-1.5 text-xs font-semibold text-sand-100 transition hover:bg-white/10"
            >
              {language === 'es' ? '🇺🇸 EN' : '🇲🇽 ES'}
            </button>

            {itemCount > 0 && (
              <Link
                to={`/r/${cart.restaurantId}/cart`}
                className="flex items-center gap-2 rounded-full bg-sunset-500 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-sunset-900/40 transition hover:bg-sunset-600"
              >
                <span aria-hidden="true">🛒</span>
                {itemCount} · ${total.toFixed(2)}
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-sunset-100 bg-dusk-900 py-6 text-center text-sm text-sand-100">
        RockyEats · {t('footer.tagline')}
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
