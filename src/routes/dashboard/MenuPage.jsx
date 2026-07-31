import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../context/AuthContext.jsx'

const emptyForm = { name: '', description: '', price: '', category: '', photo_url: '', station: 'kitchen' }

function MenuPage() {
  const { profile } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const fetchItems = async () => {
    const { data, error: fetchError } = await supabase
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', profile.restaurant_id)
      .order('category', { ascending: true })
      .order('name', { ascending: true })

    if (!fetchError) setItems(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchItems()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleAvailable = async (item) => {
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, available: !i.available } : i)),
    )
    await supabase.from('menu_items').update({ available: !item.available }).eq('id', item.id)
  }

  const toggleStation = async (item) => {
    const station = item.station === 'bar' ? 'kitchen' : 'bar'
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, station } : i)))
    await supabase.from('menu_items').update({ station }).eq('id', item.id)
  }

  const deleteItem = async (id) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
    await supabase.from('menu_items').delete().eq('id', id)
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    setError(null)
    setSaving(true)

    const { error: insertError } = await supabase.from('menu_items').insert({
      restaurant_id: profile.restaurant_id,
      name: form.name,
      description: form.description || null,
      price: Number(form.price),
      category: form.category || null,
      photo_url: form.photo_url || null,
      station: form.station,
    })

    setSaving(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    setForm(emptyForm)
    fetchItems()
  }

  return (
    <div className="space-y-8">
      <form onSubmit={handleAdd} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="font-semibold text-gray-900">Add menu item</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            required
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            required
            type="number"
            step="0.01"
            min="0"
            placeholder="Price"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Category (e.g. Tacos)"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Photo URL (optional)"
            value={form.photo_url}
            onChange={(e) => setForm({ ...form, photo_url: e.target.value })}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <select
            value={form.station}
            onChange={(e) => setForm({ ...form, station: e.target.value })}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="kitchen">Kitchen</option>
            <option value="bar">Bar</option>
          </select>
          <textarea
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm sm:col-span-2"
          />
        </div>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="mt-3 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {saving ? 'Adding…' : 'Add item'}
        </button>
      </form>

      {loading ? (
        <p className="text-gray-500">Loading menu…</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
            >
              <div>
                <p className="font-medium text-gray-900">
                  {item.name} <span className="text-gray-500">— ${item.price}</span>
                </p>
                {item.category && <p className="text-xs text-gray-500">{item.category}</p>}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => toggleStation(item)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    item.station === 'bar' ? 'bg-ocean-100 text-ocean-800' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {item.station === 'bar' ? '🍹 Bar' : '👨‍🍳 Kitchen'}
                </button>
                <label className="flex items-center gap-1.5 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={item.available}
                    onChange={() => toggleAvailable(item)}
                  />
                  Available
                </label>
                <button
                  type="button"
                  onClick={() => deleteItem(item.id)}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default MenuPage
