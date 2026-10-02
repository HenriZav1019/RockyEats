import { supabase } from './supabase.js'

// When a Turnstile site key is configured, orders go through the place-order
// edge function (which checks the Turnstile token first). Without one, the
// browser calls the place_order() database function directly. Prices, totals,
// status and payment_confirmed are always decided by the database either way.
export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || ''

const KNOWN_CODES = new Set([
  'RE_INVALID_NAME',
  'RE_INVALID_PHONE',
  'RE_RESTAURANT_UNAVAILABLE',
  'RE_RESTAURANT_CLOSED',
  'RE_MODE_UNAVAILABLE',
  'RE_PAYMENT_UNAVAILABLE',
  'RE_INVALID_ADDRESS',
  'RE_INVALID_ITEMS',
  'RE_ITEM_UNAVAILABLE',
  'RE_PRICE_CHANGED',
  'RE_RATE_LIMITED',
  'RE_CAPTCHA_FAILED',
])

function toFailure(message, details) {
  const code = KNOWN_CODES.has(message) ? message : 'RE_UNKNOWN'
  if (code === 'RE_UNKNOWN') console.error('Order failed:', message, details)
  return { data: null, code, details: details || null }
}

/**
 * @returns {Promise<{ data: object|null, code?: string, details?: string|null }>}
 *   data has the get_order_confirmation() shape: { order, order_items, restaurant }
 */
export async function placeOrder(params, turnstileToken) {
  if (TURNSTILE_SITE_KEY) {
    const { data, error } = await supabase.functions.invoke('place-order', {
      body: { ...params, turnstileToken },
    })
    if (!error) return { data: data.data }
    try {
      const body = await error.context.json()
      return toFailure(body.error, body.details)
    } catch {
      return toFailure(error.message)
    }
  }

  const { data, error } = await supabase.rpc('place_order', params)
  if (error) return toFailure(error.message, error.details)
  return { data }
}
