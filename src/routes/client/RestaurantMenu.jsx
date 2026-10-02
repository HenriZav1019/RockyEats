import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, MapPin, Minus, Plus, ShoppingBag } from 'lucide-react'
import { supabase } from '../../lib/supabase.js'
import { useCart } from '../../context/CartContext.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'
import { getOpenStatus, todayKey, useNow } from '../../lib/hours.js'
import { formatMoney, signColors } from '../../lib/format.js'
import { OpenStatusBadge, WeeklyHours } from '../../components/OpenStatus.jsx'
import ModeIcon, { MODES } from '../../components/ModeIcon.jsx'

const slug = (s) => 'cat-' + s.toLowerCase().replace(/[^a-z0-9]+/gi, '-')

function Stepper({ quantity, onMinus, onPlus, t, name }) {
  return (
    <div className="flex h-10 items-center rounded-full bg-sea-950 text-white">
      <button
        type="button"
        onClick={onMinus}
        aria-label={`${t('menu.removeOne')}: ${name}`}
        className="grid h-10 w-10 place-items-center rounded-full transition hover:bg-white/10 active:scale-90"
      >
        <Minus size={18} strokeWidth={2.5} />
      </button>
      <span className="min-w-6 text-center text-base font-bold tabular-nums" aria-live="polite">
        {quantity}
      </span>
      <button
        type="button"
        onClick={onPlus}
        aria-label={`${t('menu.addOne')}: ${name}`}
        className="grid h-10 w-10 place-items-center rounded-full transition hover:bg-white/10 active:scale-90"
      >
        <Plus size={18} strokeWidth={2.5} />
      </button>
    </div>
  )
}

function MenuItemRow({ item, quantity, canOrder, onAdd, onMinus, t }) {
  const soldOut = !item.available
  return (
    <li className={`flex gap-4 py-4 ${soldOut ? 'opacity-55' : ''}`}>
      <div className="min-w-0 flex-1">
        <p className="text-[1.05rem] font-bold leading-snug">{item.name}</p>
        {item.description && (
          <p className="mt-1 line-clamp-2 text-sm leading-snug text-sea-950/65">{item.description}</p>
        )}
        <p className="mt-2 flex items-center gap-2 text-base font-bold tabular-nums">
          {formatMoney(item.price)}
          {soldOut && (
            <span className="rounded-full bg-chili-500/10 px-2 py-0.5 text-xs font-bold text-chili-500">
              {t('menu.soldOut')}
            </span>
          )}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end justify-between gap-2">
        {item.photo_url && (
          <img
            src={item.photo_url}
            alt=""
            loading="lazy"
            className="h-20 w-20 rounded-xl object-cover ring-1 ring-sea-950/10"
          />
        )}
        {!soldOut && canOrder && (
          quantity > 0 ? (
            <Stepper quantity={quantity} onMinus={onMinus} onPlus={onAdd} t={t} name={item.name} />
          ) : (
            <button
              type="button"
              onClick={onAdd}
              aria-label={`${t('menu.addItem')}: ${item.name}`}
              className="grid h-10 w-10 place-items-center rounded-full bg-sun-500 text-white shadow-[0_4px_12px_-4px_rgba(255,106,43,0.7)] transition hover:bg-sun-600 active:scale-90"
            >
              <Plus size={20} strokeWidth={2.75} />
            </button>
          )
        )}
      </div>
    </li>
  )
}

function RestaurantMenu() {
  const { restaurantId } = useParams()
  const navigate = useNavigate()
  const { cart, addItem, updateQuantity, setMode } = useCart()
  const { t } = useLanguage()
  const [restaurant, setRestaurant] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [localMode, setLocalMode] = useState(null) // chosen before this restaurant owns the cart
  const [modeHint, setModeHint] = useState(false)
  const [activeCategory, setActiveCategory] = useState(null)
  const modeRef = useRef(null)
  const tabsRef = useRef(null)
  const now = useNow()

  useEffect(() => {
    Promise.all([
      supabase.from('restaurants').select('*').eq('id', restaurantId).single(),
      supabase.from('menu_items').select('*').eq('restaurant_id', restaurantId).order('category').order('name'),
    ]).then(([{ data: r }, { data: menuItems }]) => {
      setRestaurant(r || null)
      setItems(menuItems || [])
      setLoading(false)
    })
  }, [restaurantId])

  const inThisCart = !cart.restaurantId || cart.restaurantId === restaurantId
  const availableModes = useMemo(() => (restaurant ? MODES.filter((m) => restaurant[m.flag]) : []), [restaurant])
  const activeMode = inThisCart ? cart.mode || localMode : localMode

  // Only one way to order here? Pick it for the customer.
  useEffect(() => {
    if (availableModes.length === 1 && !activeMode) {
      if (inThisCart) setMode(availableModes[0].key)
      else setLocalMode(availableModes[0].key)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableModes])

  const grouped = useMemo(() => {
    const groups = new Map()
    for (const item of items) {
      const key = item.category || t('menu.other')
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(item)
    }
    // Sold-out items sink to the bottom of their category.
    for (const list of groups.values()) list.sort((a, b) => Number(b.available) - Number(a.available))
    // Food first: drinks and desserts read better at the end of a menu.
    const last = (name) => (/bebida|drink|postre|dessert|café|cafe|coffee/i.test(name) ? 1 : 0)
    return [...groups.entries()].sort((a, b) => last(a[0]) - last(b[0]))
  }, [items, t])

  // Highlight the category tab for the section being read.
  useEffect(() => {
    if (grouped.length < 2) return
    setActiveCategory((current) => current ?? grouped[0][0])
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActiveCategory(visible[0].target.dataset.category)
      },
      { rootMargin: '-120px 0px -60% 0px' },
    )
    grouped.forEach(([category]) => {
      const el = document.getElementById(slug(category))
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [grouped])

  // Keep the active tab visible in the horizontal scroller.
  useEffect(() => {
    if (!activeCategory || !tabsRef.current) return
    tabsRef.current.querySelector(`[data-tab="${slug(activeCategory)}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [activeCategory])

  if (loading) {
    return (
      <div aria-busy="true">
        <div className="h-48 animate-pulse bg-sea-950" />
        <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-sea-950/[0.06]" />
          ))}
        </div>
      </div>
    )
  }

  if (!restaurant) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-sea-950/70">{t('menu.notFound')}</p>
        <Link to="/" className="mt-4 inline-block rounded-full bg-sea-950 px-5 py-2.5 text-sm font-semibold text-white">
          {t('menu.backToRestaurants')}
        </Link>
      </div>
    )
  }

  const status = getOpenStatus(restaurant, now)
  const colors = signColors(restaurant.id)
  const cartItems = inThisCart ? cart.items : []
  const cartCount = cartItems.reduce((n, i) => n + i.quantity, 0)
  const cartTotal = cartItems.reduce((s, i) => s + i.price * i.quantity, 0)

  const chooseMode = (key) => {
    setModeHint(false)
    if (inThisCart) setMode(key)
    else setLocalMode(key)
  }

  const add = (item) => {
    const switching = !inThisCart
    addItem(restaurant, item, (from, to) =>
      window.confirm(t('cart.switchRestaurant').replace('{from}', from).replace('{to}', to)),
    )
    if (switching && localMode) setMode(localMode)
  }

  const goToCart = () => {
    if (!activeMode) {
      setModeHint(true)
      modeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    navigate(`/r/${restaurantId}/cart`)
  }

  return (
    <div className={cartCount > 0 ? 'pb-28' : 'pb-10'}>
      <section className="bg-sea-950 text-white">
        <div className="mx-auto max-w-3xl px-4 pb-12 pt-3">
          <Link to="/" className="-ml-2 inline-flex h-10 items-center gap-1 rounded-full pl-1 pr-3 text-sm font-semibold text-white/75 hover:text-white">
            <ChevronLeft size={20} aria-hidden="true" />
            {t('menu.back')}
          </Link>

          <div className="mt-3 flex items-end gap-4">
            {restaurant.logo_url && (
              <img src={restaurant.logo_url} alt="" className="h-16 w-16 shrink-0 rounded-2xl bg-white object-contain p-1.5" />
            )}
            <div className="min-w-0">
              <span aria-hidden="true" className={`mb-2 block h-1.5 w-12 rounded-full ${colors.bg}`} />
              <h1 className="condensed text-[2.75rem] font-extrabold leading-[0.92] sm:text-5xl">{restaurant.name}</h1>
            </div>
          </div>

          {restaurant.address && (
            <p className="mt-3 flex items-center gap-1.5 text-sm text-white/70">
              <MapPin size={15} strokeWidth={2.25} aria-hidden="true" />
              {restaurant.address}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3">
            <OpenStatusBadge status={status} tone="dark" />
            <WeeklyHours hours={restaurant.opening_hours} todayKey={todayKey(restaurant.timezone, now)} />
          </div>
          {!status.open && (
            <p className="mt-4 rounded-xl bg-white/10 px-3 py-2.5 text-sm text-white/85">
              {status.reason === 'paused' ? t('hours.pausedBanner') : t('hours.closedBanner')}
            </p>
          )}
        </div>
      </section>

      {availableModes.length > 0 && (
        <div ref={modeRef} className="relative z-10 mx-auto -mt-7 max-w-3xl px-4">
          <div
            role="radiogroup"
            aria-label={t('menu.howWouldYouLike')}
            className={`grid gap-1 rounded-2xl bg-white p-1.5 shadow-[0_8px_24px_-8px_rgba(8,32,45,0.35)] ring-1 transition ${
              modeHint ? 'ring-2 ring-sun-500' : 'ring-sea-950/10'
            }`}
            style={{ gridTemplateColumns: `repeat(${availableModes.length}, minmax(0, 1fr))` }}
          >
            {availableModes.map((m) => {
              const selected = activeMode === m.key
              return (
                <button
                  key={m.key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => chooseMode(m.key)}
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-2.5 text-[0.8rem] font-bold leading-tight transition ${
                    selected ? 'bg-sea-950 text-white' : 'text-sea-950 hover:bg-salt'
                  }`}
                >
                  <ModeIcon mode={m.key} size={20} />
                  {t(`mode.${m.key}.badge`)}
                </button>
              )
            })}
          </div>
          {modeHint && <p className="mt-2 text-center text-sm font-semibold text-sun-600">{t('menu.pickModeHint')}</p>}
        </div>
      )}

      {grouped.length > 1 && (
        <nav
          ref={tabsRef}
          aria-label={t('menu.categories')}
          className="no-scrollbar sticky top-14 z-20 mt-4 flex gap-1 overflow-x-auto border-b border-sea-950/10 bg-salt px-4"
        >
          <div className="mx-auto flex max-w-3xl gap-1">
            {grouped.map(([category]) => {
              const active = activeCategory === category
              return (
                <a
                  key={category}
                  href={`#${slug(category)}`}
                  data-tab={slug(category)}
                  onClick={(e) => {
                    e.preventDefault()
                    document.getElementById(slug(category))?.scrollIntoView({ behavior: 'smooth' })
                  }}
                  className={`shrink-0 border-b-[3px] px-3 py-3 text-sm font-bold transition ${
                    active ? 'border-sun-500 text-sea-950' : 'border-transparent text-sea-950/55 hover:text-sea-950'
                  }`}
                >
                  {category}
                </a>
              )
            })}
          </div>
        </nav>
      )}

      <div className="mx-auto max-w-3xl px-4">
        {grouped.map(([category, categoryItems]) => (
          <section key={category} id={slug(category)} data-category={category} className="scroll-mt-28 pt-6">
            <h2 className="condensed text-[1.75rem] font-extrabold leading-none">{category}</h2>
            <ul className="divide-y divide-sea-950/10">
              {categoryItems.map((item) => (
                <MenuItemRow
                  key={item.id}
                  item={item}
                  quantity={cartItems.find((i) => i.id === item.id)?.quantity || 0}
                  canOrder={status.open}
                  onAdd={() => add(item)}
                  onMinus={() => {
                    const line = cartItems.find((i) => i.id === item.id)
                    if (line) updateQuantity(item.id, line.quantity - 1)
                  }}
                  t={t}
                />
              ))}
            </ul>
          </section>
        ))}
        {items.length === 0 && <p className="py-12 text-center text-sea-950/60">{t('menu.empty')}</p>}
      </div>

      {cartCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={goToCart}
            className="mx-auto flex h-14 w-full max-w-3xl items-center gap-3 rounded-2xl bg-sun-500 px-4 text-white shadow-[0_10px_30px_-8px_rgba(233,84,26,0.6)] transition hover:bg-sun-600 active:scale-[0.99]"
          >
            <span className="relative grid h-8 w-8 place-items-center">
              <ShoppingBag size={22} strokeWidth={2.25} aria-hidden="true" />
              <span className="absolute -right-1.5 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-sea-950 px-1 text-[0.7rem] font-bold tabular-nums">
                {cartCount}
              </span>
            </span>
            <span className="flex-1 text-left text-base font-bold">{t('menu.viewCart')}</span>
            <span className="text-base font-bold tabular-nums">{formatMoney(cartTotal)}</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default RestaurantMenu
