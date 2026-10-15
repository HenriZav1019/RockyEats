import { useEffect, useState } from 'react'
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { BarChart3, ClipboardList, LayoutGrid, LogOut, Settings, UtensilsCrossed } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'
import wordmark from '../../assets/rockyeats-wordmark-tight.webp'

const STATION_HOME = { bar_staff: '/dashboard/queue/bar', kitchen_staff: '/dashboard/queue/kitchen' }

const NAV = [
  { to: '/dashboard', end: true, label: 'Pedidos', icon: ClipboardList },
  { to: '/dashboard/queue', label: 'Fila', icon: LayoutGrid },
  { to: '/dashboard/menu', label: 'Menú', icon: UtensilsCrossed },
  { to: '/dashboard/sales', label: 'Ventas', icon: BarChart3 },
  { to: '/dashboard/settings', label: 'Ajustes', icon: Settings },
]

function DashboardLayout() {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const [restaurant, setRestaurant] = useState(null)
  const stationHome = STATION_HOME[profile.role]

  useEffect(() => {
    supabase
      .from('restaurants')
      .select('id, name, logo_url, opening_hours, orders_paused, timezone')
      .eq('id', profile.restaurant_id)
      .single()
      .then(({ data }) => setRestaurant(data || null))
  }, [profile.restaurant_id])

  if (stationHome && location.pathname !== stationHome) {
    return <Navigate to={stationHome} replace />
  }

  // Queue screens run on a tablet or TV in the kitchen: dark, edge to edge.
  const screenMode = location.pathname.startsWith('/dashboard/queue')

  return (
    <div className={`min-h-screen ${screenMode ? 'bg-sea-950 text-white' : 'bg-salt text-sea-950'}`}>
      <header className="sticky top-0 z-30 bg-sea-950 text-white print:hidden">
        <div className={`mx-auto flex h-14 items-center justify-between gap-3 px-4 ${screenMode ? '' : 'max-w-5xl'}`}>
          <div className="flex min-w-0 items-center gap-3">
            <img src={wordmark} alt="RockyEats" className="h-7 w-auto shrink-0" width="520" height="165" />
            {restaurant && (
              <span className="truncate border-l border-white/20 pl-3 text-sm font-semibold text-white/80">
                {restaurant.name}
              </span>
            )}
          </div>

          {!stationHome && (
            <nav className="hidden items-center gap-1 md:flex" aria-label="Secciones">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex h-10 items-center gap-2 rounded-full px-3.5 text-sm font-semibold transition ${
                      isActive ? 'bg-white text-sea-950' : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }`
                  }
                >
                  <item.icon size={17} strokeWidth={2.25} aria-hidden="true" />
                  {item.label}
                </NavLink>
              ))}
            </nav>
          )}

          <button
            type="button"
            onClick={() => signOut()}
            className="flex h-10 shrink-0 items-center gap-2 rounded-full px-3 text-sm font-semibold text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <LogOut size={17} strokeWidth={2.25} aria-hidden="true" />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </header>

      <main
        className={`print:max-w-full print:p-0 ${
          screenMode ? 'px-3 py-4 sm:px-5' : 'mx-auto max-w-5xl px-4 py-6'
        } ${stationHome ? '' : 'pb-28 md:pb-8'}`}
      >
        <Outlet context={{ restaurant, setRestaurant }} />
      </main>

      {!stationHome && (
        <nav
          aria-label="Secciones"
          className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-white/10 bg-sea-950 pb-[env(safe-area-inset-bottom)] text-white md:hidden print:hidden"
        >
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex h-16 flex-col items-center justify-center gap-1 text-[0.7rem] font-semibold transition ${
                  isActive ? 'text-sun-500' : 'text-white/60'
                }`
              }
            >
              <item.icon size={22} strokeWidth={2.25} aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  )
}

export default DashboardLayout
