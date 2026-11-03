// notify-order: sends phone alerts (web push) about an order.
// Called only by the database trigger notify_order_push(), which sends the
// shared secret stored in private.app_settings.
//
// Deploy with JWT verification OFF (the database call has no user token; the
// secret header is what protects this endpoint).
//
// Secrets (Supabase dashboard -> Edge Functions -> Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY   from `npx web-push generate-vapid-keys`
//   VAPID_SUBJECT (optional)              e.g. mailto:you@example.com
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const MODE: Record<string, string> = { dine_in: 'Comer aquí', delivery: 'A domicilio', pickup: 'Para recoger' }

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') || 'mailto:soporte@rockyeats.app',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

let cachedSecret: string | null = null
async function expectedSecret() {
  if (cachedSecret) return cachedSecret
  const { data, error } = await supabase.rpc('get_notify_order_secret')
  if (error) throw error
  cachedSecret = data as string
  return cachedSecret
}

function money(n: number) {
  return `$${Number(n || 0).toFixed(2)}`
}

function itemsLine(items: { quantity: number; name_snapshot: string }[]) {
  const text = items.map((i) => `${i.quantity}× ${i.name_snapshot}`).join(', ')
  return text.length > 110 ? `${text.slice(0, 108)}…` : text
}

type Sub = { id: string; endpoint: string; p256dh: string; auth: string; role: string }

async function send(subs: Sub[], payload: Record<string, unknown>) {
  const body = JSON.stringify(payload)
  const gone: string[] = []
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, {
          TTL: 60 * 30, // an order alert older than 30 minutes is useless
          urgency: 'high',
        })
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) gone.push(s.id) // phone unsubscribed or app removed
        else console.error('push failed', status, (err as Error).message)
      }
    }),
  )
  if (gone.length) await supabase.from('push_subscriptions').delete().in('id', gone)
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })

  try {
    const secret = req.headers.get('x-notify-secret') || ''
    if (!secret || secret !== (await expectedSecret())) return new Response('forbidden', { status: 403 })

    const { order_id: orderId, events } = await req.json()
    if (typeof orderId !== 'string' || !Array.isArray(events)) return new Response('bad request', { status: 400 })

    const { data: order, error } = await supabase
      .from('orders')
      .select('id, order_number, restaurant_id, mode, customer_name, total, status, order_items(quantity, name_snapshot, station_snapshot)')
      .eq('id', orderId)
      .single()
    if (error || !order) return new Response('not found', { status: 404 })
    if (order.status === 'cancelled') return new Response('ok')

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth, role')
      .eq('restaurant_id', order.restaurant_id)
    const all = (subs || []) as Sub[]
    const items = order.order_items || []
    const jobs: Promise<void>[] = []

    if (events.includes('new')) {
      const owners = all.filter((s) => s.role === 'restaurant_owner')
      if (owners.length)
        jobs.push(
          send(owners, {
            title: `Nuevo pedido ${order.order_number} · ${money(order.total)}`,
            body: `${order.customer_name} · ${MODE[order.mode] || ''}\n${itemsLine(items)}`,
            tag: `order-${order.id}`,
            url: '/dashboard',
          }),
        )
    }

    if (events.includes('stations')) {
      for (const [station, role, path] of [
        ['kitchen', 'kitchen_staff', '/dashboard/queue/kitchen'],
        ['bar', 'bar_staff', '/dashboard/queue/bar'],
      ]) {
        const mine = items.filter((i: { station_snapshot: string }) => i.station_snapshot === station)
        const targets = all.filter((s) => s.role === role)
        if (mine.length && targets.length)
          jobs.push(
            send(targets, {
              title: `${station === 'bar' ? 'Bar' : 'Cocina'}: pedido ${order.order_number}`,
              body: itemsLine(mine),
              tag: `order-${order.id}-${station}`,
              url: path,
            }),
          )
      }
    }

    await Promise.all(jobs)
    return new Response('ok')
  } catch (err) {
    console.error('notify-order error', err)
    return new Response('error', { status: 500 })
  }
})
