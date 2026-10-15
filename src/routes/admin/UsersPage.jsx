import { useEffect, useState } from 'react'
import { UserMinus } from 'lucide-react'
import { supabase } from '../../lib/supabase.js'
import { ADMIN_UID } from '../../lib/adminAccess.js'
import { inputClass } from '../../components/ui.jsx'
import { Button, EmptyState, PageHeader, Panel, StatusPill } from '../../components/staff.jsx'

const ROLE_LABEL = {
  admin: 'Administrador',
  restaurant_owner: 'Dueño',
  kitchen_staff: 'Cocina',
  bar_staff: 'Bar',
}
const ROLE_HINT = {
  restaurant_owner: 'Ve pedidos, menú, ventas y ajustes de su restaurante.',
  kitchen_staff: 'Solo ve la pantalla de cocina.',
  bar_staff: 'Solo ve la pantalla de bar.',
}
const ROLE_TONE = {
  admin: 'bg-sun-500 text-white',
  restaurant_owner: 'bg-sea-950 text-white',
  kitchen_staff: 'bg-mango-400 text-sea-950',
  bar_staff: 'bg-tide-500 text-white',
}

function UsersPage() {
  const [profiles, setProfiles] = useState([])
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('restaurant_owner')
  const [restaurantId, setRestaurantId] = useState('')
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
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
    setNotice(null)
    if (!restaurantId) {
      setError('Elige el restaurante.')
      return
    }
    setSaving(true)
    const { data: userId, error: lookupError } = await supabase.rpc('admin_lookup_user_id_by_email', { lookup_email: email.trim() })
    if (lookupError || !userId) {
      setSaving(false)
      setError('No hay una cuenta con ese correo. Créala primero en Supabase: Authentication, Add user.')
      return
    }
    if (userId === ADMIN_UID) {
      setSaving(false)
      setError('Esa es la cuenta de administrador; no se le puede asignar un restaurante.')
      return
    }
    const { error: upsertError } = await supabase.from('profiles').upsert({ id: userId, role, restaurant_id: restaurantId })
    setSaving(false)
    if (upsertError) {
      setError('No se pudo guardar el acceso. Intenta de nuevo.')
      return
    }
    const rName = restaurants.find((r) => r.id === restaurantId)?.name
    setNotice(`${email.trim()} ahora tiene acceso como ${ROLE_LABEL[role].toLowerCase()} en ${rName}.`)
    setEmail('')
    fetchAll()
  }

  const removeAccess = async (p) => {
    setError(null)
    setNotice(null)
    if (!window.confirm(`¿Quitar el acceso de ${p.email}? Ya no podrá entrar al panel. Su cuenta de inicio de sesión no se borra.`)) return
    const { error: deleteError } = await supabase.from('profiles').delete().eq('id', p.id)
    if (deleteError) {
      setError('No se pudo quitar el acceso. Intenta de nuevo.')
      return
    }
    setProfiles((prev) => prev.filter((x) => x.id !== p.id))
    setNotice(`Se quitó el acceso de ${p.email}.`)
  }

  // Group by restaurant so it's easy to see who works where.
  const byRestaurant = new Map()
  for (const p of profiles) {
    const key = p.restaurant_name || 'RockyEats'
    if (!byRestaurant.has(key)) byRestaurant.set(key, [])
    byRestaurant.get(key).push(p)
  }

  return (
    <div>
      <PageHeader title="Usuarios" sub="Quién puede entrar al panel y a qué restaurante." />

      <div className="grid gap-5 lg:grid-cols-[1fr_1.3fr]">
        <Panel title="Dar acceso" sub="La persona necesita una cuenta: créala en Supabase (Authentication, Add user) y luego asígnala aquí por correo.">
          <form onSubmit={handleAssign} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">Correo</span>
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            </label>
            <div>
              <span className="mb-1.5 block text-sm font-semibold">Rol</span>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Rol">
                {['restaurant_owner', 'kitchen_staff', 'bar_staff'].map((r) => (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={role === r}
                    onClick={() => setRole(r)}
                    className={`h-11 rounded-xl text-sm font-bold transition ${role === r ? 'bg-sea-950 text-white' : 'bg-salt ring-1 ring-sea-950/15'}`}
                  >
                    {ROLE_LABEL[r]}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-sm text-sea-950/55">{ROLE_HINT[role]}</p>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">Restaurante</span>
              <select value={restaurantId} onChange={(e) => setRestaurantId(e.target.value)} className={inputClass}>
                <option value="">Elige un restaurante…</option>
                {restaurants.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            {error && (
              <p role="alert" className="rounded-xl bg-chili-500/10 px-3.5 py-3 text-sm font-semibold text-chili-500">
                {error}
              </p>
            )}
            {notice && (
              <p role="status" className="rounded-xl bg-tide-100 px-3.5 py-3 text-sm font-semibold text-sea-950">
                {notice}
              </p>
            )}
            <Button type="submit" size="lg" className="w-full" disabled={saving}>
              {saving ? 'Guardando…' : 'Dar acceso'}
            </Button>
          </form>
        </Panel>

        <div>
          {loading ? (
            <div className="space-y-3" aria-busy="true">
              {[0, 1].map((i) => (
                <div key={i} className="h-32 animate-pulse rounded-2xl bg-sea-950/[0.06]" />
              ))}
            </div>
          ) : profiles.length === 0 ? (
            <EmptyState title="Nadie tiene acceso todavía" />
          ) : (
            <div className="space-y-4">
              {[...byRestaurant.entries()].map(([name, list]) => (
                <Panel key={name} title={name}>
                  <ul className="divide-y divide-sea-950/10">
                    {list.map((p) => (
                      <li key={p.id} className="flex flex-wrap items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                        <span className="min-w-0 flex-1 truncate font-semibold">{p.email}</span>
                        <StatusPill className={ROLE_TONE[p.role]}>{ROLE_LABEL[p.role] || p.role}</StatusPill>
                        {p.role !== 'admin' && (
                          <Button tone="danger" size="sm" onClick={() => removeAccess(p)}>
                            <UserMinus size={15} aria-hidden="true" />
                            Quitar acceso
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </Panel>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default UsersPage
