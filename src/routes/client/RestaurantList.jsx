import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, MapPin, Search, X } from 'lucide-react'
import { supabase } from '../../lib/supabase.js'
import { useLanguage } from '../../context/LanguageContext.jsx'
import { getOpenStatus, useNow } from '../../lib/hours.js'
import { signColors } from '../../lib/format.js'
import { OpenStatusBadge } from '../../components/OpenStatus.jsx'
import ModeIcon, { MODES } from '../../components/ModeIcon.jsx'
import Sunset from '../../components/Sunset.jsx'

// Accent-insensitive, case-insensitive matching ("cafe" finds "Café").
const fold = (s) =>
  (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

function RestaurantSign({ restaurant, status, matchedDish }) {
  const { t } = useLanguage()
  const colors = signColors(restaurant.id)
  const closed = !status.open
  const modes = MODES.filter((m) => restaurant[m.flag])

  return (
    <Link
      to={`/r/${restaurant.id}`}
      className="group block overflow-hidden rounded-2xl bg-white ring-1 ring-sea-950/10 transition active:scale-[0.99]"
    >
      {restaurant.logo_url ? (
        <div className={`flex h-28 items-center justify-center bg-white p-4 ${closed ? 'opacity-60 grayscale' : ''}`}>
          <img src={restaurant.logo_url} alt={restaurant.name} className="max-h-full max-w-[70%] object-contain" />
        </div>
      ) : (
        <div
          className={`relative flex h-28 items-end px-4 pb-3 ${closed ? 'bg-sea-950/[0.07] text-sea-950/55' : `${colors.bg} ${colors.fg}`}`}
        >
          <span className="condensed line-clamp-2 text-[2.1rem] font-extrabold leading-[0.92]">{restaurant.name}</span>
        </div>
      )}

      <div className="space-y-1.5 px-4 py-3">
        {restaurant.logo_url && <p className="text-lg font-bold leading-tight">{restaurant.name}</p>}
        <OpenStatusBadge status={status} />
        {restaurant.address && (
          <p className="flex items-center gap-1.5 text-sm text-sea-950/60">
            <MapPin size={14} strokeWidth={2.25} aria-hidden="true" className="shrink-0" />
            <span className="truncate">{restaurant.address}</span>
          </p>
        )}
        {matchedDish && (
          <p className="text-sm text-sea-950/80">
            {t('home.matchesDish')} <strong className="font-semibold">{matchedDish}</strong>
          </p>
        )}
        <ul className="flex flex-wrap gap-x-4 gap-y-1 pt-0.5 text-sm font-medium text-sea-800">
          {modes.map((m) => (
            <li key={m.key} className="flex items-center gap-1.5">
              <ModeIcon mode={m.key} size={15} />
              {t(`mode.${m.key}.badge`)}
            </li>
          ))}
        </ul>
      </div>
    </Link>
  )
}

function FilterChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition ${
        active ? 'bg-sea-950 text-white' : 'bg-white text-sea-950 ring-1 ring-sea-950/15 hover:ring-sea-950/30'
      }`}
    >
      {children}
    </button>
  )
}

function RestaurantList() {
  const { t } = useLanguage()
  const [restaurants, setRestaurants] = useState([])
  const [dishes, setDishes] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState(null)
  const [openOnly, setOpenOnly] = useState(false)
  const now = useNow()

  useEffect(() => {
    Promise.all([
      supabase.from('restaurants').select('*').eq('is_active', true).order('name'),
      // Dish names power "search by what you're craving". Small city, small menus.
      supabase.from('menu_items').select('restaurant_id, name, category').eq('available', true),
    ]).then(([{ data: r }, { data: d }]) => {
      setRestaurants(r || [])
      setDishes(d || [])
      setLoading(false)
    })
  }, [])

  const results = useMemo(() => {
    const q = fold(query.trim())
    return restaurants
      .map((r) => {
        const status = getOpenStatus(r, now)
        let matchedDish = null
        if (q && !fold(r.name).includes(q)) {
          const dish = dishes.find(
            (d) => d.restaurant_id === r.id && (fold(d.name).includes(q) || fold(d.category).includes(q)),
          )
          if (!dish) return null
          matchedDish = dish.name
        }
        return { restaurant: r, status, matchedDish }
      })
      .filter(Boolean)
      .filter(({ restaurant }) => !mode || restaurant[MODES.find((m) => m.key === mode).flag])
      .filter(({ status }) => !openOnly || status.open)
      .sort((a, b) => Number(b.status.open) - Number(a.status.open))
  }, [restaurants, dishes, query, mode, openOnly, now])

  const filtering = Boolean(query.trim() || mode || openOnly)
  const clearFilters = () => {
    setQuery('')
    setMode(null)
    setOpenOnly(false)
  }

  return (
    <div>
      <section className="relative overflow-hidden bg-sea-950 text-white">
        <Sunset className="pointer-events-none absolute -right-10 -top-2 w-[300px] sm:right-4 sm:w-[380px]" />
        <div className="relative mx-auto max-w-3xl px-4 pb-16 pt-28 sm:pt-32">
          <h1 className="condensed max-w-[11ch] text-[3.25rem] font-extrabold leading-[0.9] sm:text-6xl">
            {t('home.heading')}
          </h1>
          <p className="mt-3 max-w-[34ch] text-base text-white/75">{t('home.subtitle')}</p>
        </div>
      </section>

      <div className="relative z-10 mx-auto -mt-7 max-w-3xl px-4">
        <label className="flex h-14 items-center gap-3 rounded-2xl bg-white px-4 shadow-[0_8px_24px_-8px_rgba(8,32,45,0.35)] ring-1 ring-sea-950/10 focus-within:ring-2 focus-within:ring-sun-500">
          <Search size={20} strokeWidth={2.25} className="shrink-0 text-sea-950/50" aria-hidden="true" />
          <span className="sr-only">{t('home.search')}</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('home.search')}
            className="h-full w-full bg-transparent text-base text-sea-950 placeholder:text-sea-950/45 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label={t('home.clearFilters')}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-sea-950/50 hover:bg-salt"
            >
              <X size={18} />
            </button>
          )}
        </label>
      </div>

      <div className="no-scrollbar mx-auto mt-4 flex max-w-3xl gap-2 overflow-x-auto px-4 pb-1">
        <FilterChip active={!mode} onClick={() => setMode(null)}>
          {t('home.filterAll')}
        </FilterChip>
        {MODES.map((m) => (
          <FilterChip key={m.key} active={mode === m.key} onClick={() => setMode(mode === m.key ? null : m.key)}>
            <ModeIcon mode={m.key} />
            {t(`mode.${m.key}.badge`)}
          </FilterChip>
        ))}
        <FilterChip active={openOnly} onClick={() => setOpenOnly((v) => !v)}>
          <Clock size={16} strokeWidth={2.25} aria-hidden="true" />
          {t('home.openNowOnly')}
        </FilterChip>
      </div>

      <section className="mx-auto max-w-3xl px-4 pb-12 pt-5">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2" aria-busy="true" aria-label={t('home.loading')}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-52 animate-pulse rounded-2xl bg-sea-950/[0.06]" />
            ))}
          </div>
        ) : restaurants.length === 0 ? (
          <p className="py-10 text-center text-sea-950/60">{t('home.empty')}</p>
        ) : results.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sea-950/70">{t('home.noMatches')}</p>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-3 rounded-full bg-sea-950 px-5 py-2.5 text-sm font-semibold text-white"
            >
              {t('home.clearFilters')}
            </button>
          </div>
        ) : (
          <>
            <p className="mb-3 text-sm font-medium text-sea-950/60">
              {results.length} {results.length === 1 ? t('home.countOne') : t('home.count')}
              {filtering && (
                <button type="button" onClick={clearFilters} className="ml-3 font-semibold text-sun-600 underline underline-offset-2">
                  {t('home.clearFilters')}
                </button>
              )}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {results.map(({ restaurant, status, matchedDish }) => (
                <RestaurantSign key={restaurant.id} restaurant={restaurant} status={status} matchedDish={matchedDish} />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  )
}

export default RestaurantList
