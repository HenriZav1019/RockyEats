import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import HoursEditor from '../../components/HoursEditor.jsx'
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

function Checkbox({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-1.5 text-sm text-gray-700">
      <input type="checkbox" checked={checked} onChange={onChange} />
      {label}
    </label>
  )
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
          ...data,
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

    if (hoursErrors(form.opening_hours).length > 0) {
      setError('Fix the opening hours before saving.')
      return
    }

    setSaving(true)

    const payload = {
      name: form.name,
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
      setError(saveError.message)
      return
    }

    const { error: bankError } = await supabase.from('restaurant_payment_details').upsert({
      restaurant_id: savedRestaurant.id,
      bank_name: form.bank_name || null,
      account_holder: form.account_holder || null,
      clabe: form.clabe || null,
      notes: form.bank_notes || null,
    })

    setSaving(false)

    if (bankError) {
      setError(bankError.message)
      return
    }

    navigate('/admin')
  }

  if (loading) return <p className="text-gray-500">Loading…</p>

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">
        {isNew ? 'New restaurant' : `Edit ${form.name}`}
      </h1>

      <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="font-medium text-gray-900">Basics</h2>
        <input
          required
          placeholder="Name"
          value={form.name}
          onChange={set('name')}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="Address"
          value={form.address}
          onChange={set('address')}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="Phone"
          value={form.phone}
          onChange={set('phone')}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="WhatsApp number, e.g. +526381234567"
          value={form.whatsapp_number}
          onChange={set('whatsapp_number')}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <div className="flex flex-wrap gap-4">
          <Checkbox label="WhatsApp enabled" checked={form.whatsapp_enabled} onChange={set('whatsapp_enabled')} />
          <Checkbox label="Active (visible to customers)" checked={form.is_active} onChange={set('is_active')} />
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="font-medium text-gray-900">Order modes</h2>
        <div className="flex flex-wrap gap-4">
          <Checkbox label="Dine-in (I'm here)" checked={form.supports_dine_in} onChange={set('supports_dine_in')} />
          <Checkbox label="Delivery" checked={form.supports_delivery} onChange={set('supports_delivery')} />
          <Checkbox label="Pickup" checked={form.supports_pickup} onChange={set('supports_pickup')} />
          <Checkbox label="Own transport" checked={form.own_transport} onChange={set('own_transport')} />
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="font-medium text-gray-900">Opening hours</h2>
        <HoursEditor
          value={form.opening_hours}
          onChange={(hours) => setForm((f) => ({ ...f, opening_hours: hours }))}
        />
        <Checkbox
          label="Orders paused (owner's quick switch)"
          checked={form.orders_paused}
          onChange={set('orders_paused')}
        />
      </section>

      <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="font-medium text-gray-900">Payment methods</h2>
        <div className="flex flex-wrap gap-4">
          <Checkbox label="Cash" checked={form.accepts_cash} onChange={set('accepts_cash')} />
          <Checkbox label="Bank transfer" checked={form.accepts_transfer} onChange={set('accepts_transfer')} />
          <Checkbox label="Card terminal" checked={form.accepts_card_terminal} onChange={set('accepts_card_terminal')} />
        </div>

        {form.accepts_card_terminal && (
          <div className="space-y-2 border-t border-gray-100 pt-3">
            <p className="text-sm text-gray-500">Which cards does the terminal accept?</p>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="radio"
                name="terminal-scope"
                checked={!form.card_terminal_mexican_cards_only}
                onChange={() => setForm((f) => ({ ...f, card_terminal_mexican_cards_only: false }))}
              />
              Any card (national or international)
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="radio"
                name="terminal-scope"
                checked={form.card_terminal_mexican_cards_only}
                onChange={() => setForm((f) => ({ ...f, card_terminal_mexican_cards_only: true }))}
              />
              Mexican cards only
            </label>
          </div>
        )}

        {form.accepts_transfer && (
          <div className="space-y-2 border-t border-gray-100 pt-3">
            <p className="text-sm text-gray-500">Shown to customers when they choose bank transfer:</p>
            <input
              placeholder="Bank name"
              value={form.bank_name}
              onChange={set('bank_name')}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              placeholder="Account holder"
              value={form.account_holder}
              onChange={set('account_holder')}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              placeholder="CLABE"
              value={form.clabe}
              onChange={set('clabe')}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <textarea
              placeholder="Notes (optional)"
              value={form.bank_notes}
              onChange={set('bank_notes')}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        )}
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {saving ? 'Saving…' : isNew ? 'Create restaurant' : 'Save changes'}
      </button>
    </form>
  )
}

export default RestaurantFormPage
