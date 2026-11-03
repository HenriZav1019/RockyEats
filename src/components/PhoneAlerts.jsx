import { useEffect, useState } from 'react'
import { BellOff, BellRing, Check, Smartphone } from 'lucide-react'
import { disablePush, enablePush, getPushState } from '../lib/push.js'
import { Button } from './staff.jsx'

const COPY = {
  on: 'Este teléfono te avisa de cada pedido nuevo, aunque RockyEats esté cerrado o la pantalla apagada.',
  off: 'Actívalo para recibir un aviso en este teléfono con cada pedido nuevo, aunque tengas RockyEats cerrado.',
  blocked:
    'Bloqueaste las notificaciones para RockyEats. Actívalas en los ajustes del navegador (el candado junto a la dirección > Notificaciones > Permitir) y vuelve aquí.',
  'needs-install':
    'En iPhone los avisos solo funcionan con RockyEats instalado: en Safari toca Compartir > Agregar a inicio, abre RockyEats desde ese ícono, inicia sesión y regresa aquí.',
  unsupported: 'Este navegador no puede recibir avisos. En Android usa Chrome; en iPhone instala RockyEats en tu pantalla de inicio.',
}

// Settings panel body: turn phone alerts on/off for this device.
function PhoneAlerts() {
  const [state, setState] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    getPushState().then(setState).catch(() => setState('unsupported'))
  }, [])

  const run = async (fn) => {
    setBusy(true)
    setError(null)
    try {
      setState(await fn())
    } catch (err) {
      console.warn('[push]', err)
      setError('No se pudo cambiar. Revisa tu conexión e intenta de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  if (!state) return <div className="h-16 animate-pulse rounded-xl bg-sea-950/[0.06]" />

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
            state === 'on' ? 'bg-tide-100 text-tide-500' : 'bg-sea-950/[0.06] text-sea-950/60'
          }`}
        >
          {state === 'on' ? <Check size={20} strokeWidth={2.75} /> : state === 'needs-install' ? <Smartphone size={20} /> : <BellOff size={20} />}
        </span>
        <div className="min-w-0">
          <p className="font-bold">{state === 'on' ? 'Avisos activos en este teléfono' : state === 'blocked' ? 'Avisos bloqueados en este teléfono' : 'Avisos apagados en este teléfono'}</p>
          <p className="mt-0.5 text-sm text-sea-950/65">{COPY[state]}</p>
        </div>
      </div>
      {state === 'off' && (
        <Button type="button" size="lg" disabled={busy} onClick={() => run(enablePush)}>
          <BellRing size={18} aria-hidden="true" />
          {busy ? 'Activando…' : 'Activar avisos en este teléfono'}
        </Button>
      )}
      {state === 'on' && (
        <Button type="button" tone="ghost" disabled={busy} onClick={() => run(disablePush)}>
          Apagar avisos en este teléfono
        </Button>
      )}
      {error && <p className="text-sm font-semibold text-chili-500">{error}</p>}
    </div>
  )
}

export default PhoneAlerts
