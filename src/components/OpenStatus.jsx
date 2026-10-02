import { DAY_KEYS, describeStatus } from '../lib/hours.js'
import { useLanguage } from '../context/LanguageContext.jsx'

// Pill for restaurant cards / headers. `status` comes from getOpenStatus().
export function OpenStatusBadge({ status, className = '' }) {
  const { t } = useLanguage()
  if (status.alwaysOpen && status.open) return null // no schedule set: don't clutter the card
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        status.open ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-700'
      } ${className}`}
    >
      <span
        aria-hidden="true"
        className={`h-2 w-2 rounded-full ${status.open ? 'bg-emerald-500' : 'bg-gray-500'}`}
      />
      {describeStatus(status, t)}
    </span>
  )
}

// Collapsible weekly schedule for the menu page.
export function WeeklyHours({ hours, todayKey }) {
  const { t } = useLanguage()
  if (!hours) return null
  return (
    <details className="mt-3 rounded-xl border border-sunset-100 bg-white p-3 text-sm shadow-sm">
      <summary className="cursor-pointer font-display font-semibold text-ocean-900">
        🕒 {t('hours.title')}
      </summary>
      <dl className="mt-2 space-y-1">
        {DAY_KEYS.map((day) => {
          const ranges = hours[day] || []
          return (
            <div
              key={day}
              className={`flex justify-between gap-4 ${day === todayKey ? 'font-semibold text-ocean-900' : 'text-gray-600'}`}
            >
              <dt className="capitalize">{t(`day.${day}`)}</dt>
              <dd>
                {ranges.length === 0
                  ? t('hours.closedDay')
                  : ranges.map((r) => `${r.open}–${r.close}`).join(', ')}
              </dd>
            </div>
          )
        })}
      </dl>
    </details>
  )
}
