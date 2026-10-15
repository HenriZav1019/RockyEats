import { useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { supabase } from '../../lib/supabase.js'
import { getOpenStatus, useNow } from '../../lib/hours.js'

const DAY_ES = { mon: 'el lunes', tue: 'el martes', wed: 'el miércoles', thu: 'el jueves', fri: 'el viernes', sat: 'el sábado', sun: 'el domingo' }

function describe(status) {
  if (status.reason === 'paused') return { title: 'Pedidos en pausa', sub: 'Los clientes ven tu menú pero no pueden pedir.' }
  if (status.open) {
    return {
      title: 'Recibiendo pedidos',
      sub: status.closesAt ? `Según tu horario cierras a las ${status.closesAt}.` : 'Sin horario: siempre abierto.',
    }
  }
  if (!status.nextOpen) return { title: 'Cerrado por horario', sub: 'No hay horas de apertura esta semana. Revisa Ajustes.' }
  const { daysAhead, dayKey, time } = status.nextOpen
  const when = daysAhead === 0 ? 'hoy' : daysAhead === 1 ? 'mañana' : DAY_ES[dayKey]
  return { title: 'Cerrado por horario', sub: `Abres ${when} a las ${time}.` }
}

// Whether customers can order right now, plus the one-tap pause switch for
// when the kitchen is overwhelmed. Owners only.
function OrderingStatusBar({ restaurant, onChange }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const now = useNow()

  if (!restaurant) return null

  const status = getOpenStatus(restaurant, now)
  const paused = restaurant.orders_paused
  const { title, sub } = describe(status)

  const togglePause = async () => {
    setSaving(true)
    setError(null)
    const { error: updateError } = await supabase
      .from('restaurants')
      .update({ orders_paused: !paused })
      .eq('id', restaurant.id)
    setSaving(false)
    if (updateError) {
      setError('No se pudo cambiar. Intenta de nuevo.')
      return
    }
    onChange?.({ orders_paused: !paused })
  }

  const tone = paused ? 'bg-mango-400 text-sea-950' : status.open ? 'bg-tide-500 text-white' : 'bg-sea-950 text-white'
  const dot = paused ? 'bg-sea-950' : status.open ? 'bg-white' : 'bg-white/50'

  return (
    <div className={`mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3.5 ${tone}`}>
      <div className="flex min-w-0 items-start gap-3">
        <span aria-hidden="true" className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${dot} ${status.open && !paused ? 'animate-pulse' : ''}`} />
        <div>
          <p className="font-bold">{title}</p>
          <p className="text-sm opacity-85">{sub}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={togglePause}
        disabled={saving}
        className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-bold transition disabled:opacity-60 ${
          paused ? 'bg-sea-950 text-white hover:bg-sea-800' : 'bg-white/95 text-sea-950 hover:bg-white'
        }`}
      >
        {paused ? <Play size={17} strokeWidth={2.5} aria-hidden="true" /> : <Pause size={17} strokeWidth={2.5} aria-hidden="true" />}
        {saving ? 'Guardando…' : paused ? 'Reanudar pedidos' : 'Pausar pedidos'}
      </button>
      {error && <p className="w-full text-sm font-semibold">{error}</p>}
    </div>
  )
}

export default OrderingStatusBar
