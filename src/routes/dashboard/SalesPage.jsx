import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Printer } from 'lucide-react'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { formatMoney } from '../../lib/format.js'
import { PAYMENT_LABEL } from '../../lib/staff.js'
import { Button, EmptyState, PageHeader, Panel, Segmented } from '../../components/staff.jsx'

const PERIODS = [
  { value: 1, label: 'Hoy' },
  { value: 7, label: '7 días' },
  { value: 30, label: '30 días' },
]

const dateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Money counts once it's actually in: payment confirmed, or the order was
// handed over (card-terminal orders are paid at delivery). Open orders that
// aren't paid yet are "por cobrar"; cancelled orders never count.
function isCollected(o) {
  return o.status !== 'cancelled' && (o.payment_confirmed || o.status === 'completed')
}
function isPending(o) {
  return !['cancelled', 'completed'].includes(o.status) && !o.payment_confirmed
}

function StatTile({ label, value, sub, tone }) {
  return (
    <div className={`rounded-2xl p-4 ${tone === 'hero' ? 'bg-sea-950 text-white' : 'bg-white ring-1 ring-sea-950/10'}`}>
      <p className={`text-sm font-semibold ${tone === 'hero' ? 'text-white/65' : 'text-sea-950/60'}`}>{label}</p>
      <p className="condensed mt-1 text-[2.1rem] font-extrabold leading-none tabular-nums">{value}</p>
      {sub && <p className={`mt-1.5 text-xs ${tone === 'hero' ? 'text-white/55' : 'text-sea-950/50'}`}>{sub}</p>}
    </div>
  )
}

// Single series (collected revenue per day): one hue, no legend, values in
// the tooltip and the table below. Bars cap at 24px with a 4px rounded top.
function DailyChart({ days }) {
  const [hover, setHover] = useState(null)
  const max = Math.max(1, ...days.map((d) => d.revenue))
  const step = max > 10000 ? 5000 : max > 4000 ? 2000 : max > 1000 ? 500 : 250
  const top = Math.ceil(max / step) * step
  const ticks = [0, top / 2, top]
  const H = 160
  const compact = (v) => (v >= 1000 ? `${(v / 1000).toLocaleString('es-MX', { maximumFractionDigits: 1 })}K` : `${v}`)

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative w-9 shrink-0 text-right text-[11px] text-sea-950/45 tabular-nums" style={{ height: H }}>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: H - (t / top) * H }}>
              {compact(t)}
            </span>
          ))}
        </div>
        <div className="relative flex-1" style={{ height: H }}>
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 border-t border-sea-950/10" style={{ top: H - (t / top) * H }} />
          ))}
          <div className="absolute inset-0 flex items-end gap-0.5">
            {days.map((d) => (
              <div
                key={d.key}
                className="relative flex h-full flex-1 items-end justify-center"
                onMouseEnter={() => setHover(d)}
                onMouseLeave={() => setHover(null)}
                onClick={() => setHover(d)}
              >
                <div
                  className={`w-full max-w-6 rounded-t transition ${hover?.key === d.key ? 'bg-sea-950' : 'bg-tide-500'}`}
                  style={{ height: d.revenue ? Math.max(3, (d.revenue / top) * H) : 0 }}
                />
                {hover?.key === d.key && (
                  <div className="pointer-events-none absolute bottom-full z-10 mb-2 whitespace-nowrap rounded-lg bg-sea-950 px-2.5 py-1.5 text-xs text-white shadow-lg">
                    <span className="font-bold">{d.label}</span>
                    <br />
                    {formatMoney(d.revenue)} · {d.orders} {d.orders === 1 ? 'pedido' : 'pedidos'}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="ml-11 mt-1.5 flex gap-0.5 text-[11px] text-sea-950/45">
        {days.map((d, i) => (
          <span key={d.key} className="flex-1 text-center">
            {i === 0 || i === days.length - 1 || (days.length <= 7) ? d.short : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

function SalesPage() {
  const { profile } = useAuth()
  const { restaurant } = useOutletContext() || {}
  const [period, setPeriod] = useState(7)
  const [orders, setOrders] = useState(null)

  useEffect(() => {
    setOrders(null)
    const since = new Date()
    since.setHours(0, 0, 0, 0)
    since.setDate(since.getDate() - (period - 1))
    supabase
      .from('orders')
      .select('id, created_at, total, status, payment_method, payment_confirmed, order_items(name_snapshot, price_snapshot, quantity, line_total)')
      .eq('restaurant_id', profile.restaurant_id)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: true })
      .limit(5000)
      .then(({ data }) => setOrders(data || []))
  }, [profile.restaurant_id, period])

  const stats = useMemo(() => {
    if (!orders) return null
    const collected = orders.filter(isCollected)
    const pending = orders.filter(isPending)
    const revenue = collected.reduce((s, o) => s + Number(o.total), 0)
    const byPayment = ['cash', 'transfer', 'card_terminal'].map((key) => {
      const list = collected.filter((o) => o.payment_method === key)
      return { key, count: list.length, total: list.reduce((s, o) => s + Number(o.total), 0) }
    })
    const days = Array.from({ length: period }, (_, i) => {
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      d.setDate(d.getDate() - (period - 1 - i))
      return {
        key: dateKey(d),
        label: d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }),
        short: d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }),
        revenue: 0,
        orders: 0,
      }
    })
    const byDay = Object.fromEntries(days.map((d) => [d.key, d]))
    for (const o of collected) {
      const bucket = byDay[dateKey(new Date(o.created_at))]
      if (bucket) {
        bucket.revenue += Number(o.total)
        bucket.orders += 1
      }
    }
    const items = new Map()
    for (const o of collected) {
      for (const it of o.order_items) {
        const k = `${it.name_snapshot}__${it.price_snapshot}`
        const g = items.get(k) || { name: it.name_snapshot, unit: Number(it.price_snapshot), quantity: 0, total: 0 }
        g.quantity += it.quantity
        g.total += Number(it.line_total)
        items.set(k, g)
      }
    }
    return {
      revenue,
      count: collected.length,
      avg: collected.length ? revenue / collected.length : 0,
      pendingTotal: pending.reduce((s, o) => s + Number(o.total), 0),
      pendingCount: pending.length,
      cancelled: orders.filter((o) => o.status === 'cancelled').length,
      byPayment,
      days,
      items: [...items.values()].sort((a, b) => b.total - a.total),
    }
  }, [orders, period])

  const periodLabel = period === 1
    ? new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : `Últimos ${period} días`

  return (
    <div>
      <div className="print:hidden">
        <PageHeader
          title="Ventas"
          sub="Solo cuenta lo cobrado: pedidos con pago recibido o entregados."
          actions={<Segmented label="Periodo" value={period} onChange={setPeriod} options={PERIODS} />}
        />
      </div>

      {!stats ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-sea-950/[0.06]" />
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 print:hidden">
            <StatTile tone="hero" label="Cobrado" value={formatMoney(stats.revenue)} sub={periodLabel} />
            <StatTile label="Pedidos cobrados" value={stats.count} sub={stats.cancelled ? `${stats.cancelled} cancelados` : undefined} />
            <StatTile label="Ticket promedio" value={formatMoney(Math.round(stats.avg))} />
            <StatTile
              label="Por cobrar"
              value={formatMoney(stats.pendingTotal)}
              sub={stats.pendingCount ? `${stats.pendingCount} pedidos sin pago confirmado` : 'Nada pendiente'}
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr] print:hidden">
            {period > 1 && (
              <Panel title="Cobrado por día">
                <DailyChart days={stats.days} />
              </Panel>
            )}
            <Panel title="Por forma de pago" className={period === 1 ? 'lg:col-span-2' : ''}>
              <ul className="space-y-3">
                {stats.byPayment.map((p) => (
                  <li key={p.key}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="font-semibold">{PAYMENT_LABEL[p.key]}</span>
                      <span className="font-bold tabular-nums">{formatMoney(p.total)}</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-sea-950/[0.06]">
                      <div className="h-full rounded-full bg-tide-500" style={{ width: `${stats.revenue ? (p.total / stats.revenue) * 100 : 0}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-sea-950/50">
                      {p.count} {p.count === 1 ? 'pedido' : 'pedidos'}
                    </p>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          <Panel className="print:rounded-none print:p-0 print:ring-0">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">{period === 1 ? 'Corte del día' : 'Lo más vendido'}</h2>
                <p className="mt-1 text-sm capitalize text-sea-950/60">
                  {restaurant?.name ? `${restaurant.name}, ` : ''}
                  {periodLabel}
                </p>
              </div>
              <Button tone="dark" size="sm" onClick={() => window.print()} disabled={stats.items.length === 0} className="print:hidden">
                <Printer size={16} aria-hidden="true" />
                Imprimir
              </Button>
            </div>
            {stats.items.length === 0 ? (
              <EmptyState title="Sin ventas cobradas en este periodo" />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-sea-950/15 text-left text-sea-950/55">
                    <th className="py-2 font-semibold">Platillo</th>
                    <th className="py-2 text-right font-semibold">Cant.</th>
                    <th className="hidden py-2 text-right font-semibold sm:table-cell">Precio</th>
                    <th className="py-2 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.items.map((it) => (
                    <tr key={`${it.name}__${it.unit}`} className="border-b border-sea-950/[0.07]">
                      <td className="py-2">{it.name}</td>
                      <td className="py-2 text-right tabular-nums">{it.quantity}</td>
                      <td className="hidden py-2 text-right tabular-nums sm:table-cell">{formatMoney(it.unit)}</td>
                      <td className="py-2 text-right tabular-nums">{formatMoney(it.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  {stats.byPayment.filter((p) => p.total > 0).map((p) => (
                    <tr key={p.key} className="text-sea-950/70">
                      <td className="pt-3" colSpan={2}>
                        {PAYMENT_LABEL[p.key]}
                      </td>
                      <td className="hidden sm:table-cell" />
                      <td className="pt-3 text-right tabular-nums">{formatMoney(p.total)}</td>
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <td className="pt-2" colSpan={2}>
                      Total cobrado
                    </td>
                    <td className="hidden sm:table-cell" />
                    <td className="pt-2 text-right tabular-nums">{formatMoney(stats.revenue)}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </Panel>
        </div>
      )}
    </div>
  )
}

export default SalesPage
