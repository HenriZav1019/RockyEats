import { useCallback, useEffect, useRef, useState } from 'react'
import { ChefHat, CircleAlert, Clock, MapPin, Martini, X } from 'lucide-react'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { playChime } from '../../lib/chime.js'
import {
  MODE_LABEL,
  NEXT_STEP,
  PAYMENT_LABEL,
  deliveryAddressLines,
  formatWait,
  minutesSince,
  useTick,
  waitTone,
} from '../../lib/staff.js'
import ModeIcon from '../../components/ModeIcon.jsx'
import { ScreenHeader, WAIT_BORDER, WAIT_TEXT } from '../../components/ScreenTools.jsx'

const NEW_ORDER_HIGHLIGHT_MS = 15000

const COLUMNS = [
  { key: 'new', title: 'Nuevos', statuses: ['submitted', 'confirmed'], accent: 'bg-sun-500' },
  { key: 'preparing', title: 'Preparando', statuses: ['preparing'], accent: 'bg-mango-400' },
  { key: 'ready', title: 'Listos', statuses: ['ready'], accent: 'bg-tide-500' },
]

function stationState(items, station) {
  const list = items.filter((i) => i.station_snapshot === station)
  if (!list.length) return null
  return list.every((i) => i.item_status === 'ready') ? 'done' : 'working'
}

function StationIcons({ items }) {
  return (
    <span className="flex gap-1.5">
      {[
        { key: 'kitchen', icon: ChefHat, label: 'Cocina' },
        { key: 'bar', icon: Martini, label: 'Bar' },
      ].map((s) => {
        const state = stationState(items, s.key)
        if (!state) return null
        return (
          <span
            key={s.key}
            title={`${s.label}: ${state === 'done' ? 'listo' : 'en proceso'}`}
            className={`grid h-7 w-7 place-items-center rounded-full ${state === 'done' ? 'bg-tide-500 text-white' : 'bg-white/10 text-white/60'}`}
          >
            <s.icon size={15} strokeWidth={2.5} aria-label={`${s.label} ${state === 'done' ? 'listo' : 'en proceso'}`} />
          </span>
        )
      })}
    </span>
  )
}

function QueuePage() {
  const { profile } = useAuth()
  const [orders, setOrders] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [newOrderIds, setNewOrderIds] = useState(new Set())
  const knownIds = useRef(null)
  const now = useTick(15000)

  const fetchOrders = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select(
        'id, order_number, mode, status, customer_name, customer_phone, payment_method, total, created_at, order_items(*), delivery_street, delivery_number, delivery_between_streets, delivery_reference, delivery_is_hotel_or_condo, delivery_unit_number',
      )
      .eq('restaurant_id', profile.restaurant_id)
      .in('status', ['submitted', 'confirmed', 'preparing', 'ready'])
      .or('payment_confirmed.eq.true,payment_method.eq.card_terminal')
      .order('created_at', { ascending: true })
    const list = data || []
    if (knownIds.current) {
      const arrived = list.filter((o) => !knownIds.current.has(o.id)).map((o) => o.id)
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
    knownIds.current = new Set(list.map((o) => o.id))
    setOrders(list)
  }, [profile.restaurant_id])

  useEffect(() => {
    fetchOrders()
    const channel = supabase
      .channel('queue-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${profile.restaurant_id}` }, () => fetchOrders())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'order_items' }, () => fetchOrders())
      .subscribe()
    const poll = setInterval(fetchOrders, 45000)
    return () => {
      supabase.removeChannel(channel)
      clearInterval(poll)
    }
  }, [fetchOrders, profile.restaurant_id])

  const selected = orders.find((o) => o.id === selectedId) || null

  const advance = async (order, nextStatus) => {
    setOrders((prev) =>
      nextStatus === 'completed' ? prev.filter((o) => o.id !== order.id) : prev.map((o) => (o.id === order.id ? { ...o, status: nextStatus } : o)),
    )
    setSelectedId(null)
    const { error } = await supabase.from('orders').update({ status: nextStatus }).eq('id', order.id)
    if (error) fetchOrders()
  }

  return (
    <div>
      <ScreenHeader title="Fila" now={now}>
        <span className="text-lg font-bold text-white/70">{orders.length} en curso</span>
      </ScreenHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const list = orders.filter((o) => col.statuses.includes(o.status))
          return (
            <section key={col.key} className="rounded-2xl bg-white/[0.04] p-3">
              <h2 className="mb-3 flex items-center gap-2 px-1 text-lg font-bold">
                <span aria-hidden="true" className={`h-3 w-3 rounded-full ${col.accent}`} />
                {col.title}
                <span className="ml-auto rounded-full bg-white/10 px-2.5 text-sm tabular-nums">{list.length}</span>
              </h2>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-2">
                {list.map((order) => {
                  const wait = minutesSince(order.created_at, now)
                  const tone = col.key === 'ready' ? 'ok' : waitTone(wait)
                  return (
                    <button
                      key={order.id}
                      type="button"
                      onClick={() => setSelectedId(order.id)}
                      className={`relative flex flex-col gap-2 rounded-xl border-t-4 bg-sea-900 p-3 text-left transition hover:bg-sea-800 active:scale-[0.98] ${WAIT_BORDER[tone]} ${
                        newOrderIds.has(order.id) ? 'ring-4 ring-sun-500' : ''
                      }`}
                    >
                      <span className="condensed text-[2.25rem] font-extrabold leading-[0.9]">{order.order_number}</span>
                      <span className="flex items-center gap-1.5 truncate text-sm font-semibold text-white/75">
                        <ModeIcon mode={order.mode} size={14} />
                        <span className="truncate">{order.customer_name}</span>
                      </span>
                      <span className="flex items-center justify-between gap-2">
                        <span className={`flex items-center gap-1 text-sm font-bold tabular-nums ${WAIT_TEXT[tone]}`}>
                          <Clock size={14} strokeWidth={2.5} aria-hidden="true" />
                          {formatWait(wait)}
                        </span>
                        <StationIcons items={order.order_items} />
                      </span>
                    </button>
                  )
                })}
                {list.length === 0 && <p className="col-span-full py-6 text-center text-sm text-white/35">Vacío</p>}
              </div>
            </section>
          )
        })}
      </div>
      <p className="mt-4 text-sm text-white/45">
        Aquí aparecen los pedidos pagados (o con tarjeta en persona). Los pendientes de pago están en Pedidos.
      </p>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onClick={() => setSelectedId(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Pedido ${selected.order_number}`}
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-sea-900 p-5 text-white sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="condensed text-5xl font-extrabold leading-none">{selected.order_number}</p>
                <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-white/70">
                  <ModeIcon mode={selected.mode} size={15} />
                  {MODE_LABEL[selected.mode]} · {PAYMENT_LABEL[selected.payment_method]} · {selected.customer_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label="Cerrar"
                className="grid h-10 w-10 place-items-center rounded-full bg-white/10 hover:bg-white/15"
              >
                <X size={20} />
              </button>
            </div>

            {selected.mode === 'delivery' && selected.delivery_street && (
              <div className="mt-4 flex gap-2 rounded-xl bg-white/[0.06] p-3 text-sm">
                <MapPin size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                <div>
                  {deliveryAddressLines(selected).map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </div>
            )}

            <ul className="mt-4 space-y-2 border-t border-white/10 pt-4">
              {selected.order_items.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-3">
                  <span>
                    <span className="text-lg font-bold">
                      <span className="tabular-nums">{item.quantity}×</span> {item.name_snapshot}
                    </span>
                    {item.notes && (
                      <span className="mt-1 flex items-start gap-1.5 rounded-lg bg-mango-400 px-2 py-1 text-sm font-bold text-sea-950">
                        <CircleAlert size={14} strokeWidth={2.5} className="mt-0.5 shrink-0" aria-hidden="true" />
                        {item.notes}
                      </span>
                    )}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                      item.item_status === 'ready' ? 'bg-tide-500 text-white' : 'bg-white/10 text-white/60'
                    }`}
                  >
                    {item.station_snapshot === 'bar' ? 'Bar' : 'Cocina'} {item.item_status === 'ready' ? 'listo' : ''}
                  </span>
                </li>
              ))}
            </ul>

            {NEXT_STEP[selected.status] && (
              <button
                type="button"
                onClick={() => advance(selected, NEXT_STEP[selected.status].status)}
                className="mt-5 flex h-14 w-full items-center justify-center rounded-2xl bg-sun-500 text-base font-bold text-white transition hover:bg-sun-600"
              >
                {NEXT_STEP[selected.status].label}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default QueuePage
