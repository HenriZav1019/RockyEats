import { Plus, X } from 'lucide-react'
import { DAY_KEYS, DAY_LABELS_ES as DAY_LABELS, hoursErrors } from '../lib/hours.js'
import { Toggle } from './staff.jsx'

const MAX_RANGES = 3
const DEFAULT_RANGE = { open: '09:00', close: '21:00' }
const timeInput =
  'h-11 rounded-xl bg-white px-3 text-base tabular-nums ring-1 ring-sea-950/15 focus:outline-none focus:ring-2 focus:ring-sun-500'

function HoursEditor({ value, onChange }) {
  const weekly = value !== null && value !== undefined
  const hours = value || {}

  const setDay = (day, ranges) => onChange({ ...hours, [day]: ranges })
  const updateRange = (day, index, field, time) =>
    setDay(day, (hours[day] || []).map((r, i) => (i === index ? { ...r, [field]: time } : r)))

  const switchMode = (toWeekly) =>
    onChange(toWeekly ? Object.fromEntries(DAY_KEYS.map((d) => [d, [{ ...DEFAULT_RANGE }]])) : null)

  const copyMondayToAll = () => {
    const monday = hours.mon || []
    onChange(Object.fromEntries(DAY_KEYS.map((d) => [d, monday.map((r) => ({ ...r }))])))
  }

  const errors = hoursErrors(value)

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Tipo de horario" className="grid gap-2 sm:grid-cols-2">
        {[
          { weekly: false, title: 'Siempre abierto', sub: 'Sin horario fijo' },
          { weekly: true, title: 'Horario semanal', sub: 'Solo se puede pedir en estas horas' },
        ].map((o) => (
          <button
            key={String(o.weekly)}
            type="button"
            role="radio"
            aria-checked={weekly === o.weekly}
            onClick={() => switchMode(o.weekly)}
            className={`rounded-xl p-3 text-left transition ${weekly === o.weekly ? 'bg-sea-950 text-white' : 'bg-salt ring-1 ring-sea-950/15'}`}
          >
            <span className="block text-sm font-bold">{o.title}</span>
            <span className={`block text-sm ${weekly === o.weekly ? 'text-white/65' : 'text-sea-950/55'}`}>{o.sub}</span>
          </button>
        ))}
      </div>

      {weekly && (
        <>
          <p className="text-sm text-sea-950/60">
            Hora de Sonora. Para horarios de noche, pon la hora de cierre antes que la de apertura: 18:00 a 02:00 cierra a las 2 de la mañana del día siguiente.
          </p>

          <ul className="divide-y divide-sea-950/10 rounded-xl ring-1 ring-sea-950/10">
            {DAY_KEYS.map((day) => {
              const ranges = hours[day] || []
              const isOpen = ranges.length > 0
              return (
                <li key={day} className="px-3.5 py-3">
                  <div className="w-full sm:w-64">
                    <Toggle
                      checked={isOpen}
                      onChange={(on) => setDay(day, on ? [{ ...DEFAULT_RANGE }] : [])}
                      label={DAY_LABELS[day]}
                      sub={isOpen ? null : 'Cerrado'}
                    />
                  </div>
                  {isOpen && (
                    <div className="mt-3 space-y-2">
                      {ranges.map((r, i) => (
                        <div key={i} className="flex flex-wrap items-center gap-2">
                          <input
                            type="time"
                            value={r.open}
                            aria-label={`${DAY_LABELS[day]}: abre`}
                            onChange={(e) => updateRange(day, i, 'open', e.target.value)}
                            className={timeInput}
                          />
                          <span className="text-sm text-sea-950/50">a</span>
                          <input
                            type="time"
                            value={r.close}
                            aria-label={`${DAY_LABELS[day]}: cierra`}
                            onChange={(e) => updateRange(day, i, 'close', e.target.value)}
                            className={timeInput}
                          />
                          {r.close && r.open && r.close < r.open && (
                            <span className="text-xs font-semibold text-sea-950/55">(día siguiente)</span>
                          )}
                          {ranges.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setDay(day, ranges.filter((_, j) => j !== i))}
                              aria-label={`Quitar este horario del ${DAY_LABELS[day].toLowerCase()}`}
                              className="grid h-9 w-9 place-items-center rounded-full text-chili-500 hover:bg-chili-500/10"
                            >
                              <X size={17} />
                            </button>
                          )}
                        </div>
                      ))}
                      {ranges.length < MAX_RANGES && (
                        <button
                          type="button"
                          onClick={() => setDay(day, [...ranges, { open: '18:00', close: '22:00' }])}
                          className="inline-flex items-center gap-1 text-sm font-semibold text-sea-800 hover:text-sea-950"
                        >
                          <Plus size={15} strokeWidth={2.5} aria-hidden="true" />
                          Agregar otro horario
                        </button>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>

          <button type="button" onClick={copyMondayToAll} className="text-sm font-semibold text-sun-600 underline underline-offset-2">
            Copiar el horario del lunes a todos los días
          </button>

          {DAY_KEYS.every((d) => !(hours[d] || []).length) && (
            <p className="rounded-xl bg-mango-400/25 px-3.5 py-3 text-sm font-semibold">
              Todos los días están cerrados: los clientes no podrán pedir.
            </p>
          )}

          {errors.length > 0 && (
            <ul role="alert" className="space-y-1 rounded-xl bg-chili-500/10 px-3.5 py-3 text-sm font-semibold text-chili-500">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

export default HoursEditor
