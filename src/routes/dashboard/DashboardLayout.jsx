import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'

const linkClass = ({ isActive }) =>
  `rounded-md px-3 py-2 text-sm font-medium ${
    isActive ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
  }`

const STATION_HOME = { bar_staff: '/dashboard/queue/bar', kitchen_staff: '/dashboard/queue/kitchen' }

function DashboardLayout() {
  const { profile, signOut } = useAuth()
  const location = useLocation()

  const stationHome = STATION_HOME[profile.role]
  if (stationHome && location.pathname !== stationHome) {
    return <Navigate to={stationHome} replace />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <nav className="flex gap-2">
            {stationHome ? (
              <NavLink to={stationHome} className={linkClass}>
                {profile.role === 'bar_staff' ? 'Bar queue' : 'Kitchen queue'}
              </NavLink>
            ) : (
              <>
                <NavLink to="/dashboard" end className={linkClass}>
                  Orders
                </NavLink>
                <NavLink to="/dashboard/queue" className={linkClass}>
                  Queue
                </NavLink>
                <NavLink to="/dashboard/menu" className={linkClass}>
                  Menu
                </NavLink>
                <NavLink to="/dashboard/sales" className={linkClass}>
                  Sales
                </NavLink>
                <NavLink to="/dashboard/settings" className={linkClass}>
                  Settings
                </NavLink>
              </>
            )}
          </nav>
          <button
            type="button"
            onClick={() => signOut()}
            className="text-sm text-gray-500 hover:text-gray-800"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 print:max-w-full print:p-0">
        <Outlet />
      </main>
    </div>
  )
}

export default DashboardLayout
