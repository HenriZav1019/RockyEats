import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { isAdminProfile } from '../lib/adminAccess.js'

function ProtectedRoute({ role, children }) {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-gray-500">Loading…</div>
  }

  if (!session || !profile) {
    return <Navigate to="/login" replace />
  }

  const allowed = Array.isArray(role) ? role.includes(profile.role) : profile.role === role
  const adminAllowed = profile.role !== 'admin' || isAdminProfile(profile)

  if (!allowed || !adminAllowed) {
    return <Navigate to="/login" replace />
  }

  return children
}

export default ProtectedRoute
