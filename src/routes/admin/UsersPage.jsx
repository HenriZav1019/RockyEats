import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'

function UsersPage() {
  const [profiles, setProfiles] = useState([])
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)

  const [email, setEmail] = useState('')
  const [role, setRole] = useState('restaurant_owner')
  const [restaurantId, setRestaurantId] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const fetchAll = async () => {
    const [{ data: profileRows, error: profileError }, { data: restaurantRows }] = await Promise.all([
      supabase.rpc('admin_list_profiles'),
      supabase.from('restaurants').select('id, name').order('name'),
    ])

    if (!profileError) setProfiles(profileRows || [])
    setRestaurants(restaurantRows || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchAll()
  }, [])

  const handleAssign = async (e) => {
    e.preventDefault()
    setError(null)

    if (role !== 'admin' && !restaurantId) {
      setError('Pick a restaurant for this role.')
      return
    }

    setSaving(true)

    const { data: userId, error: lookupError } = await supabase.rpc('admin_lookup_user_id_by_email', {
      lookup_email: email,
    })

    if (lookupError || !userId) {
      setSaving(false)
      setError(lookupError?.message || 'No user found with that email. Create their login first under Authentication in the Supabase dashboard.')
      return
    }

    const { error: upsertError } = await supabase.from('profiles').upsert({
      id: userId,
      role,
      restaurant_id: role === 'admin' ? null : restaurantId,
    })

    setSaving(false)

    if (upsertError) {
      setError(upsertError.message)
      return
    }

    setEmail('')
    setRestaurantId('')
    fetchAll()
  }

  return (
    <div className="space-y-8">
      <form onSubmit={handleAssign} className="max-w-lg space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="font-medium text-gray-900">Assign a role</h2>
        <p className="text-sm text-gray-500">
          The person must already have a login — create it under Authentication → Add user in
          the Supabase dashboard first, then assign their role here by email.
        </p>

        <input
          required
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />

        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="restaurant_owner">Restaurant owner</option>
          <option value="bar_staff">Bar staff</option>
          <option value="kitchen_staff">Kitchen staff</option>
          <option value="admin">Admin</option>
        </select>

        {role !== 'admin' && (
          <select
            value={restaurantId}
            onChange={(e) => setRestaurantId(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Select restaurant…</option>
            {restaurants.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Assign role'}
        </button>
      </form>

      <div>
        <h2 className="mb-2 font-medium text-gray-900">Current users</h2>
        {loading ? (
          <p className="text-gray-500">Loading…</p>
        ) : (
          <div className="space-y-2">
            {profiles.map((p) => (
              <div key={p.id} className="rounded-lg border border-gray-200 bg-white p-3 text-sm shadow-sm">
                <span className="font-medium text-gray-900">{p.email}</span>{' '}
                <span className="text-gray-500">
                  — {p.role}
                  {p.restaurant_name ? ` · ${p.restaurant_name}` : ''}
                </span>
              </div>
            ))}
            {profiles.length === 0 && <p className="text-gray-500">No users assigned yet.</p>}
          </div>
        )}
      </div>
    </div>
  )
}

export default UsersPage
