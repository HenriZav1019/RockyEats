import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../context/AuthContext.jsx'

const DAYS = 15

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function buildEmptyDays() {
  return Array.from({ length: DAYS }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (DAYS - 1 - i))
    return {
      key: dateKey(d),
      label: d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }),
      revenue: 0,
      items: 0,
    }
  })
}

function StatTile({ label, value }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
    </div>
  )
}

function SalesPage() {
  const { profile } = useAuth()
  const [days, setDays] = useState([])
  const [loading, setLoading] = useState(true)
  const [hovered, setHovered] = useState(null)

  useEffect(() => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - (DAYS - 1))
    cutoff.setHours(0, 0, 0, 0)

    supabase
      .from('orders')
      .select('created_at, total, status, order_items(quantity)')
      .eq('restaurant_id', profile.restaurant_id)
      .neq('status', 'cancelled')
      .gte('created_at', cutoff.toISOString())
      .then(({ data }) => {
        const buckets = buildEmptyDays()
        const byKey = Object.fromEntries(buckets.map((b) => [b.key, b]))

        for (const order of data || []) {
          const key = dateKey(new Date(order.created_at))
          const bucket = byKey[key]
          if (!bucket) continue
          bucket.revenue += Number(order.total)
          bucket.items += order.order_items.reduce((sum, i) => sum + i.quantity, 0)
        }

        setDays(buckets)
        setLoading(false)
      })
  }, [profile.restaurant_id])

  if (loading) return <p className="text-gray-500">Cargando ventas…</p>

  const totalRevenue = days.reduce((sum, d) => sum + d.revenue, 0)
  const totalItems = days.reduce((sum, d) => sum + d.items, 0)
  const avgPerDay = totalRevenue / DAYS
  const maxRevenue = Math.max(1, ...days.map((d) => d.revenue))

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Ventas — últimos {DAYS} días</h1>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile label="Ingresos totales" value={`$${totalRevenue.toFixed(2)}`} />
        <StatTile label="Artículos vendidos" value={totalItems} />
        <StatTile label="Promedio diario" value={`$${avgPerDay.toFixed(2)}`} />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-medium text-gray-700">Ingresos por día</p>

        <div className="mt-6 flex items-end gap-1.5 border-b border-gray-200 pb-1" style={{ height: 160 }}>
          {days.map((d) => (
            <div
              key={d.key}
              className="group relative flex flex-1 flex-col items-center justify-end"
              onMouseEnter={() => setHovered(d.key)}
              onMouseLeave={() => setHovered(null)}
            >
              {hovered === d.key && (
                <div className="absolute -top-14 z-10 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-xs text-white shadow-lg">
                  {d.label}: ${d.revenue.toFixed(2)} · {d.items} artículos
                </div>
              )}
              <div
                className="w-full max-w-6 rounded-t bg-ocean-600 transition group-hover:bg-ocean-700"
                style={{ height: `${Math.max(2, (d.revenue / maxRevenue) * 140)}px` }}
              />
            </div>
          ))}
        </div>

        <div className="mt-1 flex gap-1.5">
          {days.map((d, i) => (
            <div key={d.key} className="flex-1 text-center text-[10px] text-gray-400">
              {i % 2 === 0 ? d.label : ''}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default SalesPage
