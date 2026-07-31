import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { useCart } from '../../context/CartContext.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'

const MODES = [
  { key: 'dine_in', flag: 'supports_dine_in', icon: '🍽️' },
  { key: 'delivery', flag: 'supports_delivery', icon: '🛵' },
  { key: 'pickup', flag: 'supports_pickup', icon: '🥡' },
]

function RestaurantMenu() {
  const { restaurantId } = useParams()
  const navigate = useNavigate()
  const { cart, addItem, setMode } = useCart()
  const { t } = useLanguage()

  const [restaurant, setRestaurant] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('restaurants').select('*').eq('id', restaurantId).single(),
      supabase
        .from('menu_items')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('category')
        .order('name'),
    ]).then(([{ data: r }, { data: menuItems }]) => {
      setRestaurant(r || null)
      setItems(menuItems || [])
      setLoading(false)
    })
  }, [restaurantId])

  const availableModes = useMemo(
    () => (restaurant ? MODES.filter((m) => restaurant[m.flag]) : []),
    [restaurant],
  )

  const grouped = useMemo(() => {
    const groups = {}
    for (const item of items) {
      const key = item.category || 'Menu'
      if (!groups[key]) groups[key] = []
      groups[key].push(item)
    }
    return groups
  }, [items])

  const inThisCart = cart.restaurantId === restaurantId

  if (loading) return <p className="px-4 py-8 text-center text-gray-500">{t('menu.loading')}</p>

  if (!restaurant) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-gray-600">{t('menu.notFound')}</p>
        <Link to="/" className="mt-2 inline-block text-ocean-600 underline">
          {t('menu.backToRestaurants')}
        </Link>
      </div>
    )
  }

  const activeMode = inThisCart ? cart.mode : null

  return (
    <div className="pb-28">
      <section className="animate-fade-up relative overflow-hidden bg-gradient-to-br from-sunset-400 via-coral-400 to-ocean-500 px-4 py-8 text-white">
        <span className="animate-float pointer-events-none absolute -right-2 -top-2 text-6xl opacity-30" aria-hidden="true">
          🌴
        </span>
        <div className="relative mx-auto max-w-3xl text-center">
          <h1 className="font-display text-3xl font-extrabold drop-shadow-sm">{restaurant.name}</h1>
          {restaurant.address && <p className="mt-1 text-sunset-50">{restaurant.address}</p>}
        </div>
      </section>

      <section className="animate-fade-up mx-auto max-w-3xl px-4 py-5" style={{ animationDelay: '0.1s' }}>
        <p className="font-display text-sm font-semibold text-ocean-900">{t('menu.howWouldYouLike')}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {availableModes.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMode(m.key)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition active:scale-95 ${
                activeMode === m.key
                  ? 'scale-105 bg-ocean-600 text-white shadow-md'
                  : 'bg-white text-ocean-700 ring-1 ring-ocean-200 hover:bg-ocean-50'
              }`}
            >
              {m.icon} {t(`mode.${m.key}`)}
            </button>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl space-y-8 px-4">
        {Object.entries(grouped).map(([category, categoryItems], groupIndex) => (
          <div key={category} className="animate-fade-up" style={{ animationDelay: `${0.15 + groupIndex * 0.05}s` }}>
            <h2 className="font-display text-xl font-bold text-ocean-900">{category}</h2>
            <div className="mt-3 space-y-3">
              {categoryItems.map((item) => {
                const cartItem = inThisCart ? cart.items.find((i) => i.id === item.id) : null

                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between gap-3 rounded-xl border bg-white p-3 shadow-sm transition ${
                      item.available
                        ? 'border-sunset-100 hover:shadow-md'
                        : 'border-gray-100 opacity-60'
                    }`}
                  >
                    <div>
                      <p className="font-medium text-gray-900">{item.name}</p>
                      {item.description && (
                        <p className="text-sm text-gray-500">{item.description}</p>
                      )}
                      <p className="mt-1 font-semibold text-sunset-600">${item.price}</p>
                      {!item.available && (
                        <p className="text-xs font-medium text-red-600">{t('menu.soldOut')}</p>
                      )}
                    </div>

                    {item.available && (
                      <button
                        type="button"
                        onClick={() => addItem(restaurant, item)}
                        className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:scale-105 hover:bg-sunset-600 active:scale-95 ${
                          cartItem ? 'bg-ocean-600' : 'bg-sunset-500'
                        }`}
                      >
                        {cartItem ? `✓ ${cartItem.quantity}` : t('menu.add')}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {items.length === 0 && <p className="text-gray-500">{t('menu.empty')}</p>}
      </section>

      {inThisCart && cart.items.length > 0 && (
        <div className="animate-fade-up fixed inset-x-0 bottom-0 z-20 border-t border-sunset-100 bg-white/95 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <p className="text-sm text-gray-600">
              {cart.items.reduce((n, i) => n + i.quantity, 0)} {t('menu.items')} · $
              {cart.items.reduce((s, i) => s + i.price * i.quantity, 0).toFixed(2)}
            </p>
            <button
              type="button"
              onClick={() => navigate(`/r/${restaurantId}/cart`)}
              className="rounded-full bg-ocean-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:scale-105 hover:bg-ocean-700 active:scale-95"
            >
              {t('menu.viewCart')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default RestaurantMenu
