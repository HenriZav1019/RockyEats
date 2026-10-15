import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Banknote, Check, ChefHat, CircleAlert, Clock, MapPin, MessageCircle, Phone, Martini, X } from 'lucide-react'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { announceNewOrders } from '../../lib/alerts.js'
import { useLiveOrders } from '../../lib/liveOrders.js'
import { AlertsButton, LiveBadge } from '../../components/ScreenTools.jsx'
import { formatMoney } from '../../lib/format.js'
import {
  ACTIVE_STATUSES,
  MODE_LABEL,
  NEXT_STEP,
  PAYMENT_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
  deliveryAddressLines,
  formatClock,
  formatWait,
  minutesSince,
  needsPaymentCheck,
  useTick,
  waitTone,
  whatsappNumber,
} from '../../lib/staff.js'
import ModeIcon from '../../components/ModeIcon.jsx'
import { Button, EmptyState, PageHeader, Segmented, StatusPill } from '../../components/staff.jsx'
import OrderingStatusBar from './OrderingStatusBar.jsx'

const NEW_ORDER_HIGHLIGHT_MS = 15000
const HISTORY_DAYS = 30

const WAIT_TONES = {
  ok: 'bg-sea-950/[0.06] text-sea-950/70',
  slow: 'bg-mango-400 text-sea-950',
  late: 'bg-chili-500 text-white',
}

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function StationChips({ items }) {
  const stations = [
    { key: 'kitchen', label: 'Cocina', icon: ChefHat },
    { key: 'bar', label: 'Bar', icon: Martini },
  ]
    .map((s) => {
      const list = items.filter((i) => i.station_snapshot === s.key)
      return { ...s, total: list.length, ready: list.filter((i) => i.item_status === 'ready').length }
    })
    .filter((s) => s.total > 0)
  return (
    <div className="flex flex-wrap gap-1.5">
      {stations.map((s) => {
        const done = s.ready === s.total
        return (
          <span
            key={s.key}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
              done ? 'bg-tide-100 text-tide-500' : 'bg-sea-950/[0.06] text-sea-950/60'
            }`}
          >
            <s.icon size={13} strokeWidth={2.5} aria-hidden="true" />
            {s.label} {done ? 'listo' : `${s.ready}/${s.total}`}
          </span>
        )
      })}
    </div>
  )
}

function OrderCard({ order, isNew, now, onAdvance, onCancel, onPaid }) {
  const wait = minutesSince(order.created_at, now)
  const active = ACTIVE_STATUSES.includes(order.status)
  const next = NEXT_STEP[order.status]
  const unpaid = needsPaymentCheck(order)
  const address = order.mode === 'delivery' ? deliveryAddressLines(order) : []
  const wa = whatsappNumber(order.customer_phone)

  return (
    <article
      className={`overflow-hidden rounded-2xl bg-white ring-1 transition ${
        isNew ? 'ring-2 ring-sun-500 shadow-[0_0_0_6px_rgba(255,106,43,0.15)]' : 'ring-sea-950/10'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4">
        <div className="flex items-baseline gap-3">
          <span className="condensed text-[2.4rem] font-extrabold leading-none">{order.order_number}</span>
          {isNew && <StatusPill className="bg-sun-500 text-white">Nuevo</StatusPill>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusPill className={STATUS_TONE[order.status]}>{STATUS_LABEL[order.status]}</StatusPill>
          {active ? (
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${WAIT_TONES[waitTone(wait)]}`}>
              <Clock size={13} strokeWidth={2.5} aria-hidden="true" />
              {formatWait(wait)}
            </span>
          ) : (
            <span className="text-xs font-semibold text-sea-950/50 tabular-nums">{formatClock(order.created_at)}</span>
          )}
        </div>
      </div>

      <div className="grid gap-4 px-4 pb-4 pt-3 sm:grid-cols-[1fr_1.1fr]">
        <div className="space-y-2.5 text-sm">
          <div>
            <p className="text-base font-bold">{order.customer_name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <a
                href={`tel:${order.customer_phone}`}
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-sea-950/[0.06] px-3 font-semibold hover:bg-sea-950/10"
              >
                <Phone size={14} strokeWidth={2.25} aria-hidden="true" />
                {order.customer_phone}
              </a>
              <a
                href={`https://wa.me/${wa}`}
                target="_blank"
                rel="noreferrer"
                aria-label={`WhatsApp a ${order.customer_name}`}
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#1fa855]/10 px-3 font-semibold text-[#168a45] hover:bg-[#1fa855]/20"
              >
                <MessageCircle size={14} strokeWidth={2.25} aria-hidden="true" />
                WhatsApp
              </a>
            </div>
          </div>

          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 font-semibold">
            <span className="inline-flex items-center gap-1.5">
              <ModeIcon mode={order.mode} size={16} />
              {MODE_LABEL[order.mode]}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Banknote size={16} strokeWidth={2.25} aria-hidden="true" />
              {PAYMENT_LABEL[order.payment_method]}
            </span>
          </p>

          {address.length > 0 && (
            <div className="flex gap-2 rounded-xl bg-salt p-3">
              <MapPin size={16} strokeWidth={2.25} className="mt-0.5 shrink-0" aria-hidden="true" />
              <ul className="space-y-0.5">
                {address.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          )}

          {order.payment_method === 'card_terminal' ? (
            <p className="text-sea-950/60">Cobro con terminal en persona.</p>
          ) : order.payment_confirmed ? (
            <p className="inline-flex items-center gap-1.5 font-bold text-tide-500">
              <Check size={16} strokeWidth={3} aria-hidden="true" />
              Pago recibido
            </p>
          ) : null}
        </div>

        <div>
          <ul className="divide-y divide-sea-950/10 text-sm">
            {order.order_items.map((item) => (
              <li key={item.id} className="flex justify-between gap-3 py-2 first:pt-0">
                <span className="min-w-0">
                  <span className="font-bold tabular-nums">{item.quantity}×</span> {item.name_snapshot}
                  {item.notes && (
                    <span className="mt-1 flex items-start gap-1 rounded-lg bg-mango-400/25 px-2 py-1 font-semibold">
                      <CircleAlert size={14} strokeWidth={2.5} className="mt-0.5 shrink-0" aria-hidden="true" />
                      {item.notes}
                    </span>
                  )}
                </span>
                <span className="shrink-0 tabular-nums text-sea-950/70">{formatMoney(item.line_total)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-baseline justify-between border-t-2 border-sea-950 pt-2">
            <span className="text-sm font-bold">Total</span>
            <span className="condensed text-2xl font-extrabold tabular-nums">{formatMoney(order.total)}</span>
          </div>
          {active && order.order_items.length > 0 && (
            <div className="mt-3">
              <StationChips items={order.order_items} />
            </div>
          )}
        </div>
      </div>

      {active && (
        <div className="space-y-2 border-t border-sea-950/10 bg-salt/60 px-4 py-3">
          {unpaid && (
            <p className="text-sm text-sea-950/70">
              Cocina y bar verán este pedido cuando confirmes el pago.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {unpaid && (
              <Button tone="success" size="lg" className="flex-1" onClick={() => onPaid(order)}>
                <Check size={19} strokeWidth={3} aria-hidden="true" />
                Pago recibido
              </Button>
            )}
            {next && (
              <Button tone={unpaid ? 'ghost' : 'primary'} size="lg" className="flex-1" onClick={() => onAdvance(order, next.status)}>
                {next.label}
              </Button>
            )}
            <Button tone="danger" size="lg" onClick={() => onCancel(order)} aria-label={`Cancelar pedido ${order.order_number}`}>
              <X size={18} strokeWidth={2.75} aria-hidden="true" />
              <span className="hidden sm:inline">Cancelar</span>
            </Button>
          </div>
        </div>
      )}
    </article>
  )
}

const ORDER_SELECT = '*, order_items(*)'

function OrdersPage() {
  const { profile } = useAuth()
  const { restaurant, setRestaurant } = useOutletContext() || {}
  const [orders, setOrders] = useState([])
  const [history, setHistory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('active')
  const [newOrderIds, setNewOrderIds] = useState(new Set())
  const [error, setError] = useState(null)
  const now = useTick()
  const knownIds = useRef(null)

  // Active orders from any day, plus everything from today.
  const fetchOrders = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('orders')
      .select(ORDER_SELECT)
      .eq('restaurant_id', profile.restaurant_id)
      .or(`status.in.(${ACTIVE_STATUSES.join(',')}),created_at.gte.${startOfToday().toISOString()}`)
      .order('created_at', { ascending: false })
      .limit(300)
    if (fetchError) {
      setError('No pudimos cargar los pedidos. Revisa tu conexión.')
      setLoading(false)
      return
    }
    setError(null)
    const list = data || []
    // Highlight + chime for orders that weren't here on the last load.
    if (knownIds.current) {
      const arrivedOrders = list.filter((o) => !knownIds.current.has(o.id))
      const arrived = arrivedOrders.map((o) => o.id)
      if (arrived.length) {
        announceNewOrders(arrivedOrders)
        setNewOrderIds((prev) => new Set([...prev, ...arrived]))
        arrived.forEach((id) =>
          setTimeout(() => setNewOrderIds((prev) => {
            const next = new Set(prev)
            next.delete(id)
            return next
          }), NEW_ORDER_HIGHLIGHT_MS),
        )
      }
    }
    knownIds.current = new Set(list.map((o) => o.id))
    setOrders(list)
    setLoading(false)
  }, [profile.restaurant_id])

  const fetchHistory = useCallback(async () => {
    const since = startOfToday()
    since.setDate(since.getDate() - HISTORY_DAYS)
    const { data } = await supabase
      .from('orders')
      .select(ORDER_SELECT)
      .eq('restaurant_id', profile.restaurant_id)
      .in('status', ['completed', 'cancelled'])
      .lt('created_at', startOfToday().toISOString())
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(200)
    setHistory(data || [])
  }, [profile.restaurant_id])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])
  const live = useLiveOrders({ restaurantId: profile.restaurant_id, onChange: fetchOrders })

  useEffect(() => {
    if (tab === 'history' && history === null) fetchHistory()
  }, [tab, history, fetchHistory])

  const update = async (order, patch) => {
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, ...patch } : o)))
    const { error: updateError } = await supabase.from('orders').update(patch).eq('id', order.id)
    if (updateError) {
      setError(`No se pudo actualizar el pedido ${order.order_number}. Intenta de nuevo.`)
      fetchOrders()
    }
  }

  const onCancel = (order) => {
    if (window.confirm(`¿Cancelar el pedido ${order.order_number} de ${order.customer_name}? El cliente verá que se canceló.`)) {
      update(order, { status: 'cancelled' })
    }
  }

  const { active, doneToday } = useMemo(() => {
    const act = orders.filter((o) => ACTIVE_STATUSES.includes(o.status))
    // Oldest first: that's the order they should be cooked in.
    act.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    return { active: act, doneToday: orders.filter((o) => !ACTIVE_STATUSES.includes(o.status)) }
  }, [orders])

  const list = tab === 'active' ? active : tab === 'today' ? doneToday : history || []
  const todayRevenue = doneToday.filter((o) => o.status === 'completed').reduce((s, o) => s + Number(o.total), 0)

  return (
    <div>
      <PageHeader
        title="Pedidos"
        sub={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
            <LiveBadge mode={live} dark={false} />
          </span>
        }
        actions={<AlertsButton dark={false} />}
      />

      <OrderingStatusBar restaurant={restaurant} onChange={(patch) => setRestaurant?.((r) => ({ ...r, ...patch }))} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Filtrar pedidos"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'active', label: 'Activos', count: active.length },
            { value: 'today', label: 'Hoy', count: doneToday.length },
            { value: 'history', label: 'Historial' },
          ]}
        />
        {tab === 'today' && doneToday.length > 0 && (
          <p className="text-sm font-semibold text-sea-950/60">
            Entregado hoy: <span className="text-sea-950 tabular-nums">{formatMoney(todayRevenue)}</span>
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-chili-500/10 px-3.5 py-3 text-sm font-semibold text-chili-500">
          {error}
        </p>
      )}

      {loading || (tab === 'history' && history === null) ? (
        <div className="space-y-4" aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i} className="h-56 animate-pulse rounded-2xl bg-sea-950/[0.06]" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          title={tab === 'active' ? 'Sin pedidos activos' : tab === 'today' ? 'Nada entregado hoy todavía' : 'Sin historial reciente'}
        >
          {tab === 'active'
            ? 'Cuando llegue un pedido sonará un aviso y aparecerá aquí.'
            : tab === 'history'
              ? `Aquí aparecen los pedidos entregados o cancelados de los últimos ${HISTORY_DAYS} días.`
              : null}
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {list.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              now={now}
              isNew={newOrderIds.has(order.id)}
              onAdvance={(o, status) => update(o, { status })}
              onPaid={(o) => update(o, { payment_confirmed: true })}
              onCancel={onCancel}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default OrdersPage
