// Opening-hours logic for display. The database (restaurant_is_open_at) is the
// authority and refuses orders when closed; this mirrors it so the UI can say
// "Open until 22:00" / "Opens tomorrow 08:00" without a round trip.
//
// opening_hours shape: null (always open) or
//   { mon: [{ open: '13:00', close: '16:00' }, ...], fri: [{ open: '18:00', close: '02:00' }] }
// A missing day or [] is closed. close < open means the range runs past midnight.

import { useEffect, useState } from 'react'

export const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const DEFAULT_TZ = 'America/Hermosillo'
const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

// Day index (0 = mon) and minutes since midnight in the restaurant's timezone.
function localParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timeZone || DEFAULT_TZ,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type) => parts.find((p) => p.type === type)?.value
  const dayIndex = DAY_KEYS.indexOf(get('weekday').toLowerCase().slice(0, 3))
  return { dayIndex, minutes: Number(get('hour')) * 60 + Number(get('minute')) }
}

const rangesFor = (hours, dayIndex) => hours?.[DAY_KEYS[(dayIndex + 7) % 7]] || []
const isOvernight = (r) => toMinutes(r.close) < toMinutes(r.open)

/**
 * @returns {{
 *   open: boolean,
 *   reason: 'paused' | 'schedule' | null,
 *   alwaysOpen: boolean,
 *   closesAt: string | null,                 // when open with a schedule
 *   nextOpen: { daysAhead: number, dayKey: string, time: string } | null  // when closed by schedule
 * }}
 */
export function getOpenStatus(restaurant, date = new Date()) {
  const hours = restaurant?.opening_hours ?? null
  const alwaysOpen = hours === null

  if (restaurant?.orders_paused) {
    return { open: false, reason: 'paused', alwaysOpen, closesAt: null, nextOpen: null }
  }
  if (alwaysOpen) {
    return { open: true, reason: null, alwaysOpen, closesAt: null, nextOpen: null }
  }

  const { dayIndex, minutes } = localParts(date, restaurant.timezone)

  for (const r of rangesFor(hours, dayIndex)) {
    const o = toMinutes(r.open)
    const c = toMinutes(r.close)
    if ((o < c && minutes >= o && minutes < c) || (c < o && minutes >= o)) {
      return { open: true, reason: null, alwaysOpen, closesAt: r.close, nextOpen: null }
    }
  }
  for (const r of rangesFor(hours, dayIndex - 1)) {
    if (isOvernight(r) && minutes < toMinutes(r.close)) {
      return { open: true, reason: null, alwaysOpen, closesAt: r.close, nextOpen: null }
    }
  }

  // Closed: find the next opening within the coming week.
  let nextOpen = null
  for (let daysAhead = 0; daysAhead <= 7 && !nextOpen; daysAhead++) {
    const candidates = rangesFor(hours, dayIndex + daysAhead)
      .map((r) => r.open)
      .filter((open) => daysAhead > 0 || toMinutes(open) > minutes)
      .sort()
    if (candidates.length > 0) {
      nextOpen = { daysAhead, dayKey: DAY_KEYS[(dayIndex + daysAhead) % 7], time: candidates[0] }
    }
  }
  return { open: false, reason: 'schedule', alwaysOpen, closesAt: null, nextOpen }
}

// Short human label: "Abierto hasta las 22:00" / "Abre el viernes a las 18:00".
export function describeStatus(status, t) {
  if (status.reason === 'paused') return t('hours.paused')
  if (status.open) {
    return status.closesAt ? `${t('hours.openUntil')} ${status.closesAt}` : t('hours.openNow')
  }
  if (!status.nextOpen) return t('hours.closedNow')
  const { daysAhead, dayKey, time } = status.nextOpen
  const when =
    daysAhead === 0
      ? t('hours.today')
      : daysAhead === 1
        ? t('hours.tomorrow')
        : `${t('hours.onDay')} ${t(`day.${dayKey}`)}`.trim()
  return `${t('hours.opens')} ${when} ${t('hours.at')} ${time}`
}

// Re-render every minute so open/closed labels stay current on an idle page.
export function useNow(intervalMs = 60000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

// 'mon'..'sun' for "today" in the restaurant's timezone.
export function todayKey(timeZone, date = new Date()) {
  return DAY_KEYS[localParts(date, timeZone).dayIndex]
}

// ---- Owner/admin editor helpers (dashboard is English) ----
export const DAY_LABELS_EN = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
}
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

// Returns a list of problems ([] = valid) so the parent can block saving.
export function hoursErrors(hours) {
  if (!hours) return []
  const errors = []
  for (const day of DAY_KEYS) {
    for (const r of hours[day] || []) {
      if (!TIME_RE.test(r.open) || !TIME_RE.test(r.close)) errors.push(`${DAY_LABELS_EN[day]}: enter both times`)
      else if (r.open === r.close) errors.push(`${DAY_LABELS_EN[day]}: opening and closing time can't be the same`)
    }
  }
  return errors
}

// Drops empty days so the saved JSON stays tidy (a missing day = closed).
export function normalizeHours(hours) {
  if (!hours) return null
  const out = {}
  for (const day of DAY_KEYS) if (hours[day]?.length) out[day] = hours[day]
  return out
}
