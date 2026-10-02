// place-order: verifies a Cloudflare Turnstile token, then creates the order
// through the place_order() database function using the service role.
//
// Deploy with JWT verification OFF (the site uses an sb_publishable_ key, which
// is not a JWT). Turnstile is what gates this endpoint instead.
//
// Secrets (Supabase dashboard -> Edge Functions -> Secrets):
//   TURNSTILE_SECRET_KEY   from Cloudflare -> Turnstile -> your widget
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function verifyTurnstile(token: string, ip: string | null): Promise<boolean> {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY')
  if (!secret) {
    console.error('TURNSTILE_SECRET_KEY is not set')
    return false
  }
  const form = new FormData()
  form.append('secret', secret)
  form.append('response', token)
  if (ip) form.append('remoteip', ip)
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
    })
    const outcome = await res.json()
    return outcome.success === true
  } catch (err) {
    console.error('Turnstile verification request failed', err)
    return false
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'RE_INVALID_ITEMS' }, 400)
  }

  const token = typeof body.turnstileToken === 'string' ? body.turnstileToken : ''
  const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  if (!token || !(await verifyTurnstile(token, ip))) {
    return json({ error: 'RE_CAPTCHA_FAILED' }, 403)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  const { data, error } = await supabase.rpc('place_order', {
    p_restaurant_id: body.p_restaurant_id,
    p_mode: body.p_mode,
    p_payment_method: body.p_payment_method,
    p_customer_name: body.p_customer_name,
    p_customer_phone: body.p_customer_phone,
    p_items: body.p_items,
    p_delivery: body.p_delivery ?? null,
    p_expected_total: body.p_expected_total ?? null,
  })

  if (error) {
    // RE_* codes are expected business errors; anything else gets logged.
    if (!error.message?.startsWith('RE_')) console.error('place_order failed', error)
    return json({ error: error.message, details: error.details ?? null }, 400)
  }

  return json({ data })
})
