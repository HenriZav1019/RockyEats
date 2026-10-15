// Shared Spanish vocabulary and helpers for the staff side (dashboard,
// kitchen/bar screens, admin). Owners and staff are local, so this side is
// Spanish only; the customer side is bilingual via translations.js.

import { useEffect, useState } from 'react'

export const MODE_LABEL = { dine_in: 'Comer aquí', delivery: 'A domicilio', pickup: 'Para recoger' }
export const PAYMENT_LABEL = { cash: 'Efectivo', transfer: 'Transferencia', card_terminal: 'Tarjeta' }

export const STATUS_LABEL = {
  submitted: 'Nuevo',
  confirmed: 'Confirmado',
  preparing: 'Preparando',
  ready: 'Listo',
  completed: 'Entregado',
  cancelled: 'Cancelado',
}

// The one obvious next step for each status, with the button text that says
// exactly what happens.
export const NEXT_STEP = {
  submitted: { status: 'confirmed', label: 'Confirmar pedido' },
  confirmed: { status: 'preparing', label: 'Empezar a preparar' },
  preparing: { status: 'ready', label: 'Marcar listo' },
  ready: { status: 'completed', label: 'Marcar entregado' },
}

export const ACTIVE_STATUSES = ['submitted', 'confirmed', 'preparing', 'ready']

export const STATUS_TONE = {
  submitted: 'bg-sun-500 text-white',
  confirmed: 'bg-mango-400 text-sea-950',
  preparing: 'bg-sea-800 text-white',
  ready: 'bg-tide-500 text-white',
  completed: 'bg-sea-950/10 text-sea-950/70',
  cancelled: 'bg-chili-500/10 text-chili-500',
}

// Card-terminal orders are paid in person, so they never wait on "Pago recibido".
export const needsPaymentCheck = (order) => order.payment_method !== 'card_terminal' && !order.payment_confirmed

export function minutesSince(iso, now = new Date()) {
  return Math.max(0, Math.floor((now - new Date(iso)) / 60000))
}

export function formatWait(minutes) {
  if (minutes < 1) return 'ahora'
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

// Kitchen convention: fine, getting long, too long.
export function waitTone(minutes) {
  if (minutes >= 25) return 'late'
  if (minutes >= 15) return 'slow'
  return 'ok'
}

export function formatClock(iso) {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function deliveryAddressLines(order) {
  if (!order.delivery_street) return []
  const lines = [`${order.delivery_street} #${order.delivery_number}`]
  if (order.delivery_between_streets) lines.push(`Entre calles: ${order.delivery_between_streets}`)
  if (order.delivery_is_hotel_or_condo) lines.push(`Hotel/condominio, habitación ${order.delivery_unit_number}`)
  if (order.delivery_reference) lines.push(`Referencia: ${order.delivery_reference}`)
  return lines
}

// wa.me needs the full international number. Ten digits is a Mexican number
// without its country code; US customers usually type +1.
export function whatsappNumber(phone = '') {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `52${digits}`
  return digits
}

// Re-render on an interval so wait times tick on an idle screen.
export function useTick(intervalMs = 30000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
