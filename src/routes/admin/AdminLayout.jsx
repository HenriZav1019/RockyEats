import { NavLink, Outlet } from 'react-router-dom'
import { LogOut, Store, Users } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import wordmark from '../../assets/rockyeats-wordmark-tight.webp'

const NAV = [
  { to: '/admin', end: true, label: 'Restaurantes', icon: Store },
  { to: '/admin/users', label: 'Usuarios', icon: Users },
]

function AdminLayout() {
  const { signOut } = useAuth()
  return (
    <div className="min-h-screen bg-salt text-sea-950">
      <header className="sticky top-0 z-30 bg-sea-950 text-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-3">
            <img src={wordmark} alt="RockyEats" className="h-7 w-auto" width="520" height="165" />
            <span className="rounded-full bg-sun-500 px-2.5 py-0.5 text-xs font-bold">Admin</span>
          </div>
          <nav className="flex items-center gap-1" aria-label="Secciones">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold transition ${
                    isActive ? 'bg-white text-sea-950' : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <item.icon size={17} strokeWidth={2.25} aria-hidden="true" />
                <span className="hidden sm:inline">{item.label}</span>
              </NavLink>
            ))}
            <button
              type="button"
              onClick={() => signOut()}
              aria-label="Salir"
              className="ml-1 grid h-10 w-10 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
            >
              <LogOut size={17} strokeWidth={2.25} />
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 pb-16">
        <Outlet />
      </main>
    </div>
  )
}

export default AdminLayout
