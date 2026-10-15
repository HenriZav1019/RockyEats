import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, MapPin, Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase.js'
import { getOpenStatus, useNow } from '../../lib/hours.js'
import { signColors } from '../../lib/format.js'
import { Button, EmptyState, PageHeader, StatusPill, Toggle } from '../../components/staff.jsx'

function statusPill(r, now) {
  if (!r.is_active) return { label: 'Oculto', tone: 'bg-sea-950/10 text-sea-950/60' }
  const s = getOpenStatus(r, now)
  if (s.reason === 'paused') return { label: 'Pedidos en pausa', tone: 'bg-mango-400 text-sea-950' }
  if (!s.open) return { label: 'Cerrado ahora', tone: 'bg-sea-950 text-white' }
  return { label: 'Abierto', tone: 'bg-tide-500 text-white' }
}

function RestaurantsPage() {
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState(null)
  const now = useNow()

  useEffect(() => {
    supabase
      .from('restaurants')
      .select('*')
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (error) setMessage('No pudimos cargar los restaurantes.')
        setRestaurants(data || [])
        setLoading(false)
      })
  }, [])

  const toggleActive = async (restaurant, isActive) => {
    setRestaurants((prev) => prev.map((r) => (r.id === restaurant.id ? { ...r, is_active: isActive } : r)))
    const { error } = await supabase.from('restaurants').update({ is_active: isActive }).eq('id', restaurant.id)
    if (error) {
      setRestaurants((prev) => prev.map((r) => (r.id === restaurant.id ? { ...r, is_active: !isActive } : r)))
      setMessage(`No se pudo cambiar "${restaurant.name}".`)
    }
  }

  const deleteRestaurant = async (restaurant) => {
    setMessage(null)
    if (!window.confirm(`¿Eliminar "${restaurant.name}" para siempre? No se puede deshacer.`)) return
    const { error } = await supabase.from('restaurants').delete().eq('id', restaurant.id)
    if (error) {
      setMessage(
        `No se pudo eliminar "${restaurant.name}": probablemente tiene pedidos o usuarios asignados. Quita sus usuarios en Usuarios, o apaga "Visible" para ocultarlo.`,
      )
      return
    }
    setRestaurants((prev) => prev.filter((r) => r.id !== restaurant.id))
  }

  return (
    <div>
      <PageHeader
        title="Restaurantes"
        sub={loading ? ' ' : `${restaurants.length} en la plataforma, ${restaurants.filter((r) => r.is_active).length} visibles`}
        actions={
          <Link
            to="/admin/restaurants/new"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-sun-500 px-4 text-sm font-bold text-white hover:bg-sun-600"
          >
            <Plus size={18} strokeWidth={2.75} aria-hidden="true" />
            Nuevo restaurante
          </Link>
        }
      />

      {message && (
        <p role="alert" className="mb-4 rounded-xl bg-chili-500/10 px-3.5 py-3 text-sm font-semibold text-chili-500">
          {message}
        </p>
      )}

      {loading ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-sea-950/[0.06]" />
          ))}
        </div>
      ) : restaurants.length === 0 ? (
        <EmptyState title="Todavía no hay restaurantes">Agrega el primero con “Nuevo restaurante”.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {restaurants.map((r) => {
            const pill = statusPill(r, now)
            const colors = signColors(r.id)
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-sea-950/10">
                <span aria-hidden="true" className={`h-12 w-2 shrink-0 rounded-full ${colors.bg}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-bold leading-tight">{r.name}</p>
                    <StatusPill className={pill.tone}>{pill.label}</StatusPill>
                  </div>
                  {r.address && (
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-sea-950/60">
                      <MapPin size={14} aria-hidden="true" />
                      {r.address}
                    </p>
                  )}
                </div>
                <div className="flex w-full items-center gap-2 sm:w-auto">
                  <div className="mr-auto w-36 sm:mr-2">
                    <Toggle checked={r.is_active} onChange={(v) => toggleActive(r, v)} label="Visible" />
                  </div>
                  <a
                    href={`/r/${r.id}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Ver menú de ${r.name}`}
                    className="grid h-11 w-11 place-items-center rounded-xl ring-1 ring-sea-950/15 hover:ring-sea-950/30"
                  >
                    <ExternalLink size={17} />
                  </a>
                  <Link
                    to={`/admin/restaurants/${r.id}`}
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-sea-950 px-4 text-sm font-bold text-white hover:bg-sea-800"
                  >
                    <Pencil size={15} aria-hidden="true" />
                    Editar
                  </Link>
                  <Button tone="danger" onClick={() => deleteRestaurant(r)} aria-label={`Eliminar ${r.name}`}>
                    <Trash2 size={17} aria-hidden="true" />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default RestaurantsPage
