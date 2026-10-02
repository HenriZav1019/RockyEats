import { DAY_KEYS, DAY_LABELS_EN as DAY_LABELS, hoursErrors } from '../lib/hours.js'

const MAX_RANGES = 3
const DEFAULT_RANGE = { open: '09:00', close: '21:00' }

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
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4 text-sm text-gray-700">
        <label className="flex items-center gap-2">
          <input type="radio" name="hours-mode" checked={!weekly} onChange={() => switchMode(false)} />
          Always open (no set hours)
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="hours-mode" checked={weekly} onChange={() => switchMode(true)} />
          Set weekly hours
        </label>
      </div>

      {weekly && (
        <>
          <p className="text-xs text-gray-500">
            Customers can only order during these hours (Sonora time). For late nights, set a closing
            time earlier than opening, e.g. 18:00 – 02:00 runs past midnight.
          </p>

          <div className="divide-y divide-gray-100 rounded-md border border-gray-200">
            {DAY_KEYS.map((day) => {
              const ranges = hours[day] || []
              const isOpen = ranges.length > 0
              return (
                <div key={day} className="flex flex-wrap items-start gap-3 px-3 py-2">
                  <label className="flex w-32 shrink-0 items-center gap-2 pt-1.5 text-sm font-medium text-gray-800">
                    <input
                      type="checkbox"
                      checked={isOpen}
                      onChange={(e) => setDay(day, e.target.checked ? [{ ...DEFAULT_RANGE }] : [])}
                    />
                    {DAY_LABELS[day]}
                  </label>

                  {isOpen ? (
                    <div className="flex flex-1 flex-col gap-2">
                      {ranges.map((r, i) => (
                        <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
                          <input
                            type="time"
                            value={r.open}
                            aria-label={`${DAY_LABELS[day]} opens`}
                            onChange={(e) => updateRange(day, i, 'open', e.target.value)}
                            className="rounded-md border border-gray-300 px-2 py-1"
                          />
                          <span className="text-gray-400">–</span>
                          <input
                            type="time"
                            value={r.close}
                            aria-label={`${DAY_LABELS[day]} closes`}
                            onChange={(e) => updateRange(day, i, 'close', e.target.value)}
                            className="rounded-md border border-gray-300 px-2 py-1"
                          />
                          {r.close && r.open && r.close < r.open && (
                            <span className="text-xs text-gray-500">(next day)</span>
                          )}
                          {ranges.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setDay(day, ranges.filter((_, j) => j !== i))}
                              className="text-xs text-red-600 hover:underline"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      ))}
                      {ranges.length < MAX_RANGES && (
                        <button
                          type="button"
                          onClick={() => setDay(day, [...ranges, { open: '18:00', close: '22:00' }])}
                          className="self-start text-xs font-medium text-ocean-700 hover:underline"
                        >
                          + Add another time slot
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="pt-1.5 text-sm text-gray-400">Closed</span>
                  )}
                </div>
              )
            })}
          </div>

          <button
            type="button"
            onClick={copyMondayToAll}
            className="text-xs font-medium text-ocean-700 hover:underline"
          >
            Copy Monday's hours to every day
          </button>

          {DAY_KEYS.every((d) => !(hours[d] || []).length) && (
            <p className="rounded-md bg-amber-50 p-2 text-sm text-amber-800">
              Every day is set to closed, so customers won’t be able to order at all.
            </p>
          )}

          {errors.length > 0 && (
            <ul className="list-inside list-disc text-sm text-red-600">
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
