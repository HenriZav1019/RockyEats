import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'

const linkClass = ({ isActive }) =>
  `rounded-md px-3 py-2 text-sm font-medium ${
    isActive ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
  }`

function DashboardLayout() {
  const { signOut } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <nav className="flex gap-2">
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

      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}

export default DashboardLayout
