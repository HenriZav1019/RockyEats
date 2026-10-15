import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, CircleAlert, Clock, RotateCcw } from 'lucide-react'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { playChime } from '../../lib/chime.js'
import { MODE_LABEL, formatWait, minutesSince, useTick, waitTone } from '../../lib/staff.js'
import ModeIcon from '../../components/ModeIcon.jsx'
import { ScreenHeader, WAIT_BORDER, WAIT_TEXT } from '../../components/ScreenTools.jsx'

const NEW_ORDER_HIGHLIGHT_MS = 15000
const STATION_TITLE = { kitchen: 'Cocina', bar: 'Bar' }

function Ticket({ order, isNew, now, onToggle }) {
  const wait = minutesSince(order.created_at, now)
  const tone = waitTone(wait)
  const remaining = order.order_items.filter((i) => i.item_status !== 'ready').length

  return (
    <article
      className={`flex flex-col overflow-hidden rounded-2xl border-t-[6px] bg-sea-900 ${WAIT_BORDER[tone]} ${
        isNew ? 'ring-4 ring-sun-500' : ''
      }`}
    >
      <header className="flex items-start justify-between gap-3 px-4 pb-2 pt-3">
        <div>
          <p className="condensed text-[3rem] font-extrabold leading-[0.9]">{order.order_number}</p>
          <p className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold text-white/70">
            <ModeIcon mode={order.mode} size={15} />
            {MODE_LABEL[order.mode]} · {order.customer_name}
          </p>
        </div>
        <div className="text-right">
          {isNew && <span className="mb-1 inline-block rounded-full bg-sun-500 px-2.5 py-0.5 text-xs font-bold">Nuevo</span>}
          <p className={`flex items-center justify-end gap-1 text-lg font-bold tabular-nums ${WAIT_TEXT[tone]}`}>
            <Clock size={17} strokeWidth={2.5} aria-hidden="true" />
            {formatWait(wait)}
          </p>
        </div>
      </header>

      <ul className="flex-1 space-y-1.5 px-2 pb-2">
        {order.order_items.map((item) => {
          const done = item.item_status === 'ready'
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onToggle(item, done ? 'pending' : 'ready')}
                aria-pressed={done}
                className={`flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition active:scale-[0.99] ${
                  done ? 'bg-tide-500/15' : 'bg-white/[0.06] hover:bg-white/10'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${
                    done ? 'bg-tide-500 text-white' : 'ring-2 ring-white/35'
                  }`}
                >
                  {done && <Check size={17} strokeWidth={3} />}
                </span>
                <span className="min-w-0">
                  <span className={`block text-lg font-bold leading-snug ${done ? 'text-white/45 line-through' : ''}`}>
                    <span className="tabular-nums">{item.quantity}×</span> {item.name_snapshot}
                  </span>
                  {item.notes && (
                    <span className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-mango-400 px-2 py-1 text-sm font-bold text-sea-950">
                      <CircleAlert size={15} strokeWidth={2.5} className="mt-0.5 shrink-0" aria-hidden="true" />
                      {item.notes}
                    </span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <footer className="border-t border-white/10 px-4 py-2.5 text-sm font-semibold text-white/60">
        {remaining === 0 ? 'Todo listo' : `Faltan ${remaining} de ${order.order_items.length}`}
      </footer>
    </article>
  )
}

function StationQueuePage({ station }) {
  const { profile } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [newOrderIds, setNewOrderIds] = useState(new Set())
  const knownIds = useRef(null)
  const now = useTick(15000)

  const fetchOrders = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select('id, order_number, mode, status, customer_name, payment_method, created_at, order_items(*)')
      .eq('restaurant_id', profile.restaurant_id)
      .in('status', ['submitted', 'confirmed', 'preparing', 'ready'])
      .or('payment_confirmed.eq.true,payment_method.eq.card_terminal')
      .order('created_at', { ascending: true })

    const relevant = (data || [])
      .map((o) => ({ ...o, order_items: o.order_items.filter((i) => i.station_snapshot === station) }))
      .filter((o) => o.order_items.length > 0)

    if (knownIds.current) {
      const arrived = relevant.filter((o) => !knownIds.current.has(o.id)).map((o) => o.id)
      if (arrived.length) {
        playChime()
        setNewOrderIds((prev) => new Set([...prev, ...arrived]))
        arrived.forEach((id) =>
          setTimeout(
            () => setNewOrderIds((prev) => {
              const next = new Set(prev)
              next.delete(id)
              return next
            }),
            NEW_ORDER_HIGHLIGHT_MS,
          ),
        )
      }
    }
    knownIds.current = new Set(relevant.map((o) => o.id))
    setOrders(relevant)
    setLoading(false)
  }, [profile.restaurant_id, station])

  useEffect(() => {
    fetchOrders()
    const channel = supabase
      .channel(`station-queue-${station}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${profile.restaurant_id}` }, () => fetchOrders())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => fetchOrders())
      .subscribe()
    const poll = setInterval(fetchOrders, 45000) // backstop for flaky kitchen wifi
    return () => {
      supabase.removeChannel(channel)
      clearInterval(poll)
    }
  }, [fetchOrders, profile.restaurant_id, station])

  const toggleItem = async (item, itemStatus) => {
    setOrders((prev) =>
      prev.map((o) => ({
        ...o,
        order_items: o.order_items.map((i) => (i.id === item.id ? { ...i, item_status: itemStatus } : i)),
      })),
    )
    const { error } = await supabase.from('order_items').update({ item_status: itemStatus }).eq('id', item.id)
    if (error) fetchOrders()
  }

  const isDone = (o) => o.order_items.every((i) => i.item_status === 'ready')
  const pending = orders.filter((o) => !isDone(o))
  const done = orders.filter(isDone)
  const late = pending.filter((o) => waitTone(minutesSince(o.created_at, now)) === 'late').length

  return (
    <div>
      <ScreenHeader title={STATION_TITLE[station]} now={now}>
        <span className="text-lg font-bold text-white/70">
          {pending.length} {pending.length === 1 ? 'pendiente' : 'pendientes'}
        </span>
        {late > 0 && <span className="text-lg font-bold text-chili-400">{late} con retraso</span>}
      </ScreenHeader>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : pending.length === 0 ? (
        <div className="grid min-h-[40vh] place-items-center rounded-2xl border-2 border-dashed border-white/15 text-center">
          <div>
            <p className="condensed text-4xl font-extrabold">Todo al día</p>
            <p className="mt-1 text-white/60">Los pedidos pagados aparecen aquí en cuanto llegan.</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {pending.map((order) => (
            <Ticket key={order.id} order={order} now={now} isNew={newOrderIds.has(order.id)} onToggle={toggleItem} />
          ))}
        </div>
      )}

      {done.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-bold text-white/60">Listos, esperando entrega</h2>
          <div className="flex flex-wrap gap-2">
            {done.map((order) => (
              <button
                key={order.id}
                type="button"
                onClick={() => {
                  if (window.confirm(`¿Regresar el pedido ${order.order_number} a pendientes?`)) {
                    order.order_items.forEach((i) => toggleItem(i, 'pending'))
                  }
                }}
                title="Volver a pendiente"
                className="group inline-flex h-12 items-center gap-2 rounded-xl bg-tide-500/15 px-4 font-bold text-tide-100 hover:bg-tide-500/25"
              >
                <span className="condensed text-2xl font-extrabold">{order.order_number}</span>
                <RotateCcw size={15} className="opacity-50 group-hover:opacity-100" aria-label="Volver a pendiente" />
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export default StationQueuePage
