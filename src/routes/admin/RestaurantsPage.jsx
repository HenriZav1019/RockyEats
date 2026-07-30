import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'

function RestaurantsPage() {
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchRestaurants = async () => {
    const { data, error } = await supabase
      .from('restaurants')
      .select('*')
      .order('name', { ascending: true })

    if (!error) setRestaurants(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchRestaurants()
  }, [])

  const toggleActive = async (restaurant) => {
    setRestaurants((prev) =>
      prev.map((r) => (r.id === restaurant.id ? { ...r, is_active: !r.is_active } : r)),
    )
    await supabase
      .from('restaurants')
      .update({ is_active: !restaurant.is_active })
      .eq('id', restaurant.id)
  }

  if (loading) return <p className="text-gray-500">Loading restaurants…</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Restaurants</h1>
        <Link
          to="/admin/restaurants/new"
          className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          + New restaurant
        </Link>
      </div>

      <div className="space-y-2">
        {restaurants.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
          >
            <div>
              <p className="font-medium text-gray-900">{r.name}</p>
              <p className="text-xs text-gray-500">{r.address}</p>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-sm text-gray-700">
                <input type="checkbox" checked={r.is_active} onChange={() => toggleActive(r)} />
                Active
              </label>
              <Link
                to={`/admin/restaurants/${r.id}`}
                className="text-sm text-gray-700 hover:text-gray-900"
              >
                Edit
              </Link>
            </div>
          </div>
        ))}

        {restaurants.length === 0 && <p className="text-gray-500">No restaurants yet.</p>}
      </div>
    </div>
  )
}

export default RestaurantsPage
