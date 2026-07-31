import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useCart } from '../../context/CartContext.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'

function CartPage() {
  const { restaurantId } = useParams()
  const navigate = useNavigate()
  const { cart, updateQuantity, updateNotes, total } = useCart()
  const { t } = useLanguage()

  if (cart.restaurantId !== restaurantId || cart.items.length === 0) {
    return <Navigate to={`/r/${restaurantId}`} replace />
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="font-display text-2xl font-bold text-ocean-900">{t('cart.title')}</h1>
      <p className="text-sm text-gray-500">{cart.restaurantName}</p>

      <div className="mt-5 space-y-3">
        {cart.items.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-sunset-100 bg-white p-3 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-gray-900">{item.name}</p>
                <p className="text-sm text-gray-500">
                  ${item.price} {t('cart.each')}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                  className="h-8 w-8 rounded-full bg-sand-200 text-lg font-bold text-ocean-900 transition hover:bg-sand-100 active:scale-90"
                >
                  −
                </button>
                <span className="w-6 text-center font-medium">{item.quantity}</span>
                <button
                  type="button"
                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                  className="h-8 w-8 rounded-full bg-sunset-500 text-lg font-bold text-white transition hover:bg-sunset-600 active:scale-90"
                >
                  +
                </button>
              </div>
            </div>

            <input
              type="text"
              value={item.notes}
              onChange={(e) => updateNotes(item.id, e.target.value)}
              placeholder={t('cart.notesPlaceholder')}
              className="mt-2 w-full rounded-md border border-gray-200 bg-sand-50 px-2.5 py-1.5 text-sm text-gray-700 placeholder:text-gray-400 focus:border-ocean-400 focus:outline-none"
            />
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-sunset-100 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between text-lg font-semibold text-gray-900">
          <span>{t('cart.total')}</span>
          <span>${total.toFixed(2)}</span>
        </div>
        {cart.mode ? (
          <p className="mt-1 text-sm text-gray-500">
            {t('cart.mode')}: {t(`mode.${cart.mode}`)}
          </p>
        ) : (
          <p className="mt-1 text-sm text-red-600">{t('cart.pickModeFirst')}</p>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <Link to={`/r/${restaurantId}`} className="text-sm font-medium text-ocean-700 hover:underline">
          {t('cart.keepBrowsing')}
        </Link>
        <button
          type="button"
          disabled={!cart.mode}
          onClick={() => navigate(`/r/${restaurantId}/checkout`)}
          className="rounded-full bg-ocean-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:scale-105 hover:bg-ocean-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
        >
          {t('cart.continue')}
        </button>
      </div>
    </div>
  )
}

export default CartPage
