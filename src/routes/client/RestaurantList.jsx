import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { useLanguage } from '../../context/LanguageContext.jsx'
import { getOpenStatus, useNow } from '../../lib/hours.js'
import { OpenStatusBadge } from '../../components/OpenStatus.jsx'
import heroMobile from '../../assets/hero-mobile.webp'
import heroDesktop from '../../assets/hero-desktop.webp'

const MODE_BADGES = [
  { key: 'supports_dine_in', icon: '🍽️', labelKey: 'mode.dine_in.badge' },
  { key: 'supports_delivery', icon: '🛵', labelKey: 'mode.delivery.badge' },
  { key: 'supports_pickup', icon: '🥡', labelKey: 'mode.pickup.badge' },
]

function RestaurantList() {
  const { t } = useLanguage()
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)
  const now = useNow()

  // Open restaurants first; within each group keep alphabetical order.
  const withStatus = useMemo(
    () =>
      restaurants
        .map((r) => ({ ...r, status: getOpenStatus(r, now) }))
        .sort((a, b) => Number(b.status.open) - Number(a.status.open)),
    [restaurants, now],
  )

  useEffect(() => {
    supabase
      .from('restaurants')
      .select('*')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        setRestaurants(data || [])
        setLoading(false)
      })
  }, [])

  return (
    <div>
      <section className="relative overflow-hidden bg-ocean-900">
        <picture>
          <source media="(min-width: 768px)" srcSet={heroDesktop} />
          <img
            src={heroMobile}
            alt="RockyEats — Local food, your way. Puerto Peñasco, Sonora."
            className="block w-full object-cover object-top sm:max-h-[420px] md:max-h-[460px]"
          />
        </picture>
      </section>

      <section className="animate-fade-up mx-auto max-w-3xl px-4 pb-2 pt-8 text-center sm:pt-10">
        <p className="font-display text-sm font-semibold uppercase tracking-widest text-sunset-600">
          {t('home.tagline')}
        </p>
        <h1 className="mt-2 font-display text-3xl font-extrabold text-ocean-900 sm:text-4xl">
          {t('home.heading')}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-base text-gray-600 sm:text-lg">
          {t('home.subtitle')}
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-8">
        <h2 className="font-display text-2xl font-bold text-ocean-900">{t('home.restaurants')}</h2>

        {loading && <p className="mt-4 text-gray-500">{t('home.loading')}</p>}

        {!loading && restaurants.length === 0 && (
          <p className="mt-4 text-gray-500">{t('home.empty')}</p>
        )}

        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {withStatus.map((r, index) => (
            <Link
              key={r.id}
              to={`/r/${r.id}`}
              style={{ animationDelay: `${index * 0.08}s` }}
              className={`animate-fade-up group overflow-hidden rounded-2xl border border-sunset-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl active:scale-[0.98] ${
                r.status.open ? '' : 'opacity-75 grayscale-[35%]'
              }`}
            >
              {r.logo_url ? (
                <div className="flex h-24 items-center justify-center bg-white">
                  <img src={r.logo_url} alt={r.name} className="h-full w-full object-contain p-3" />
                </div>
              ) : (
                <div className="flex h-24 items-center justify-center bg-gradient-to-br from-sunset-300 via-coral-400 to-ocean-500 transition group-hover:from-sunset-400 group-hover:to-ocean-600">
                  <span className="font-display text-2xl font-bold text-white drop-shadow">
                    {r.name}
                  </span>
                </div>
              )}
              <div className="p-4">
                <OpenStatusBadge status={r.status} className="mb-2" />
                {r.address && <p className="text-sm text-gray-500">{r.address}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {MODE_BADGES.filter((b) => r[b.key]).map((b) => (
                    <span
                      key={b.key}
                      className="rounded-full bg-ocean-100 px-2.5 py-1 text-xs font-medium text-ocean-800"
                    >
                      {b.icon} {t(b.labelKey)}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-sm font-semibold text-sunset-600 opacity-0 transition group-hover:opacity-100">
                  {t('home.viewMenu')}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}

export default RestaurantList
