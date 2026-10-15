import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { supabase } from '../../lib/supabase.js'
import HoursEditor from '../../components/HoursEditor.jsx'
import { inputClass } from '../../components/ui.jsx'
import { Button, Panel, Toggle } from '../../components/staff.jsx'
import { hoursErrors, normalizeHours } from '../../lib/hours.js'

const emptyForm = {
  name: '',
  address: '',
  phone: '',
  whatsapp_number: '',
  whatsapp_enabled: true,
  supports_dine_in: true,
  supports_delivery: false,
  supports_pickup: true,
  own_transport: false,
  accepts_cash: true,
  accepts_transfer: false,
  accepts_card_terminal: false,
  card_terminal_mexican_cards_only: false,
  is_active: true,
  opening_hours: null,
  orders_paused: false,
  bank_name: '',
  account_holder: '',
  clabe: '',
  bank_notes: '',
}

function RestaurantFormPage() {
  const { id } = useParams()
  const isNew = !id
  const navigate = useNavigate()

  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isNew) return

    Promise.all([
      supabase.from('restaurants').select('*').eq('id', id).single(),
      supabase.from('restaurant_payment_details').select('*').eq('restaurant_id', id).maybeSingle(),
    ]).then(([{ data }, { data: bank }]) => {
      if (data) {
        setForm({
          ...emptyForm,
          ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v ?? emptyForm[k] ?? ''])),
          opening_hours: data.opening_hours ?? null,
          bank_name: bank?.bank_name || '',
          account_holder: bank?.account_holder || '',
          clabe: bank?.clabe || '',
          bank_notes: bank?.notes || '',
        })
      }
      setLoading(false)
    })
  }, [id, isNew])

  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [key]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!form.name.trim()) return setError('Escribe el nombre del restaurante.')
    if (!form.supports_dine_in && !form.supports_delivery && !form.supports_pickup) {
      return setError('Activa al menos un tipo de pedido.')
    }
    if (!form.accepts_cash && !form.accepts_transfer && !form.accepts_card_terminal) {
      return setError('Activa al menos una forma de pago.')
    }
    if (form.clabe && !/^\d{18}$/.test(form.clabe.replace(/\s/g, ''))) {
      return setError('La CLABE debe tener 18 dígitos.')
    }
    if (form.whatsapp_number && form.whatsapp_number.replace(/\D/g, '').length < 10) {
      return setError('El WhatsApp debe incluir lada, por ejemplo +52 638 123 4567.')
    }
    if (hoursErrors(form.opening_hours).length > 0) return setError('Corrige el horario antes de guardar.')

    setSaving(true)

    const payload = {
      name: form.name.trim(),
      address: form.address || null,
      phone: form.phone || null,
      whatsapp_number: form.whatsapp_number || null,
      whatsapp_enabled: form.whatsapp_enabled,
      supports_dine_in: form.supports_dine_in,
      supports_delivery: form.supports_delivery,
      supports_pickup: form.supports_pickup,
      own_transport: form.own_transport,
      accepts_cash: form.accepts_cash,
      accepts_transfer: form.accepts_transfer,
      accepts_card_terminal: form.accepts_card_terminal,
      card_terminal_mexican_cards_only: form.card_terminal_mexican_cards_only,
      is_active: form.is_active,
      opening_hours: normalizeHours(form.opening_hours),
      orders_paused: form.orders_paused,
    }

    const { data: savedRestaurant, error: saveError } = isNew
      ? await supabase.from('restaurants').insert(payload).select().single()
      : await supabase.from('restaurants').update(payload).eq('id', id).select().single()

    if (saveError) {
      setSaving(false)
      setError('No se pudo guardar el restaurante. Revisa los datos e intenta de nuevo.')
      return
    }

    const { error: bankError } = await supabase.from('restaurant_payment_details').upsert({
      restaurant_id: savedRestaurant.id,
      bank_name: form.bank_name || null,
      account_holder: form.account_holder || null,
      clabe: form.clabe ? form.clabe.replace(/\s/g, '') : null,
      notes: form.bank_notes || null,
    })

    setSaving(false)

    if (bankError) {
      setError('El restaurante se guardó, pero los datos bancarios no. Intenta guardar de nuevo.')
      return
    }

    navigate('/admin')
  }

  const text = (key, label, props = {}) => (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      <input value={form[key] ?? ''} onChange={set(key)} className={inputClass} {...props} />
    </label>
  )
  const toggle = (key, label, sub) => (
    <Toggle checked={Boolean(form[key])} onChange={(v) => setForm((f) => ({ ...f, [key]: v }))} label={label} sub={sub} />
  )

  if (loading) return <div className="h-96 animate-pulse rounded-2xl bg-sea-950/[0.06]" aria-busy="true" />

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <Link to="/admin" className="-ml-2 inline-flex h-10 items-center gap-1 rounded-full pl-1 pr-3 text-sm font-semibold text-sea-950/60 hover:text-sea-950">
          <ChevronLeft size={20} aria-hidden="true" />
          Restaurantes
        </Link>
        <h1 className="condensed mt-1 text-[2.25rem] font-extrabold leading-none">{isNew ? 'Nuevo restaurante' : form.name || 'Editar restaurante'}</h1>
      </div>

      <Panel title="Datos generales">
        <div className="grid gap-4 sm:grid-cols-2">
          {text('name', 'Nombre', { required: true })}
          {text('address', 'Dirección')}
          {text('phone', 'Teléfono', { type: 'tel' })}
          {text('whatsapp_number', 'WhatsApp', { type: 'tel', placeholder: '+52 638 123 4567' })}
        </div>
        <div className="mt-5 space-y-4 border-t border-sea-950/10 pt-4">
          {toggle('is_active', 'Visible para clientes', 'Apágalo para ocultarlo sin borrarlo')}
          {toggle('whatsapp_enabled', 'Avisos por WhatsApp', 'El cliente puede mandar su pedido al WhatsApp del restaurante')}
          {toggle('orders_paused', 'Pedidos en pausa', 'El dueño también lo cambia desde Pedidos')}
        </div>
      </Panel>

      <Panel title="Tipos de pedido">
        <div className="space-y-4">
          {toggle('supports_dine_in', 'Comer aquí')}
          {toggle('supports_pickup', 'Para recoger')}
          {toggle('supports_delivery', 'A domicilio')}
          {form.supports_delivery && (
            <div className="ml-1 border-l-2 border-sea-950/10 pl-4">{toggle('own_transport', 'Reparto propio', 'El restaurante tiene repartidor')}</div>
          )}
        </div>
      </Panel>

      <Panel title="Formas de pago">
        <div className="space-y-4">
          {toggle('accepts_cash', 'Efectivo')}
          {toggle('accepts_card_terminal', 'Tarjeta (terminal en persona)')}
          {form.accepts_card_terminal && (
            <div className="ml-1 border-l-2 border-sea-950/10 pl-4">{toggle('card_terminal_mexican_cards_only', 'Solo tarjetas mexicanas')}</div>
          )}
          {toggle('accepts_transfer', 'Transferencia')}
          {form.accepts_transfer && (
            <div className="grid gap-4 rounded-xl bg-salt p-4 sm:grid-cols-2">
              <p className="text-sm text-sea-950/60 sm:col-span-2">El cliente ve estos datos al elegir transferencia.</p>
              {text('bank_name', 'Banco')}
              {text('account_holder', 'Titular')}
              {text('clabe', 'CLABE (18 dígitos)', { inputMode: 'numeric', className: `${inputClass} tabular-nums` })}
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold">Notas <span className="font-normal text-sea-950/50">opcional</span></span>
                <input value={form.bank_notes ?? ''} onChange={set('bank_notes')} className={inputClass} />
              </label>
            </div>
          )}
        </div>
      </Panel>

      <Panel title="Horario">
        <HoursEditor value={form.opening_hours} onChange={(hours) => setForm((f) => ({ ...f, opening_hours: hours }))} />
      </Panel>

      {error && (
        <p role="alert" className="rounded-xl bg-chili-500/10 px-3.5 py-3 text-sm font-semibold text-chili-500">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Link to="/admin" className="inline-flex h-14 items-center rounded-xl px-5 text-base font-bold text-sea-950/70 hover:text-sea-950">
          Cancelar
        </Link>
        <Button type="submit" size="lg" disabled={saving} className="min-w-48">
          {saving ? 'Guardando…' : isNew ? 'Crear restaurante' : 'Guardar cambios'}
        </Button>
      </div>
    </form>
  )
}

export default RestaurantFormPage
