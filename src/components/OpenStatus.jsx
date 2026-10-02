import { ChevronDown, Clock } from 'lucide-react'
import { DAY_KEYS, describeStatus } from '../lib/hours.js'
import { useLanguage } from '../context/LanguageContext.jsx'

// Dot + one line of status. `tone="dark"` for use on navy/colored backgrounds.
// `status` comes from getOpenStatus().
export function OpenStatusBadge({ status, tone = 'light', className = '' }) {
  const { t } = useLanguage()
  if (status.alwaysOpen && status.open) return null // no schedule set: nothing useful to say
  const text = describeStatus(status, t)
  const colors =
    tone === 'dark'
      ? status.open
        ? 'bg-tide-500 text-white'
        : 'bg-white/15 text-white'
      : status.open
        ? 'text-tide-500'
        : 'text-sea-950/60'
  const pill = tone === 'dark' ? 'rounded-full px-3 py-1' : ''
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${colors} ${pill} ${className}`}>
      <span
        aria-hidden="true"
        className={`h-2 w-2 shrink-0 rounded-full ${
          status.open ? (tone === 'dark' ? 'bg-white' : 'bg-tide-500') : tone === 'dark' ? 'bg-white/60' : 'bg-sea-950/40'
        }`}
      />
      {text}
    </span>
  )
}

// Collapsible weekly schedule for the menu page.
export function WeeklyHours({ hours, todayKey }) {
  const { t } = useLanguage()
  if (!hours) return null
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-white/80 hover:text-white [&::-webkit-details-marker]:hidden">
        <Clock size={15} strokeWidth={2.25} aria-hidden="true" />
        {t('hours.title')}
        <ChevronDown size={15} className="transition group-open:rotate-180" aria-hidden="true" />
      </summary>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 rounded-xl bg-white/10 p-3 text-sm">
        {DAY_KEYS.map((day) => {
          const ranges = hours[day] || []
          const isToday = day === todayKey
          return (
            <div key={day} className={`contents ${isToday ? 'font-bold text-white' : 'text-white/75'}`}>
              <dt className="capitalize">{t(`day.${day}`)}</dt>
              <dd className="text-right tabular-nums">
                {ranges.length === 0 ? t('hours.closedDay') : ranges.map((r) => `${r.open}–${r.close}`).join(', ')}
              </dd>
            </div>
          )
        })}
      </dl>
    </details>
  )
}
