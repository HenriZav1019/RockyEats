import { useEffect, useState } from 'react'
import { BellRing, Volume2 } from 'lucide-react'
import { alertsReady, enableAlerts } from '../lib/alerts.js'

// "Activar sonido y avisos": browsers keep audio (and notifications) off until
// someone taps. Stays visible and pulsing until alerts are on.
export function AlertsButton({ dark = true }) {
  const [ready, setReady] = useState(alertsReady())
  useEffect(() => {
    // The dashboard also unlocks audio on the first tap anywhere; pick that up.
    const id = setInterval(() => setReady(alertsReady()), 2000)
    return () => clearInterval(id)
  }, [])
  if (ready) {
    return (
      <span className={`inline-flex h-11 items-center gap-2 rounded-xl px-3.5 text-sm font-bold ${dark ? 'bg-white/10 text-white/80' : 'bg-sea-950/[0.06] text-sea-950/70'}`}>
        <Volume2 size={18} aria-hidden="true" />
        Avisos activos
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={async () => {
        await enableAlerts()
        setReady(alertsReady())
      }}
      className="inline-flex h-11 animate-pulse items-center gap-2 rounded-xl bg-mango-400 px-3.5 text-sm font-bold text-sea-950"
    >
      <BellRing size={18} aria-hidden="true" />
      Activar sonido y avisos
    </button>
  )
}

const LIVE = {
  live: { label: 'En vivo', dot: 'bg-tide-500', pulse: true },
  connecting: { label: 'Conectando…', dot: 'bg-mango-400', pulse: true },
  polling: { label: 'Se actualiza cada pocos segundos', dot: 'bg-mango-400', pulse: false },
}

export function LiveBadge({ mode, dark = true }) {
  const s = LIVE[mode] || LIVE.connecting
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-sm font-semibold ${dark ? 'text-white/60' : 'text-sea-950/55'}`}
      title={mode === 'polling' ? 'La conexión en vivo no está disponible; revisamos pedidos nuevos cada 8 segundos.' : undefined}
    >
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${s.dot} ${s.pulse ? 'animate-pulse' : ''}`} />
      {s.label}
    </span>
  )
}

// Header strip for the dark kitchen/bar/queue screens: title, live counts,
// a clock you can read from across the kitchen, and the alerts switch.
export function ScreenHeader({ title, children, now, live }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="condensed text-[2.5rem] font-extrabold leading-none">{title}</h1>
        {children}
        {live && <LiveBadge mode={live} />}
      </div>
      <div className="flex items-center gap-2">
        <span className="condensed text-3xl font-extrabold tabular-nums text-white/80">
          {now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })}
        </span>
        <AlertsButton />
      </div>
    </div>
  )
}

export const WAIT_BORDER = { ok: 'border-white/15', slow: 'border-mango-400', late: 'border-chili-500' }
export const WAIT_TEXT = { ok: 'text-white/70', slow: 'text-mango-400', late: 'text-chili-400' }
