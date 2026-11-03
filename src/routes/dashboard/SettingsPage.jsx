import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Check } from 'lucide-react'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../context/AuthContext.jsx'
import PhoneAlerts from '../../components/PhoneAlerts.jsx'
import PhotoPicker from '../../components/PhotoPicker.jsx'
import HoursEditor from '../../components/HoursEditor.jsx'
import { hoursErrors, normalizeHours } from '../../lib/hours.js'
import { inputClass } from '../../components/ui.jsx'
import { Button, PageHeader, Panel, Toggle } from '../../components/staff.jsx'

function SettingsPage() {
  const { profile } = useAuth()
  const { setRestaurant } = useOutletContext() || {}
  const [logoUrl, setLogoUrl] = useState('')
  const [payment, setPayment] = useState({
    accepts_cash: true,
    accepts_transfer: false,
    accepts_card_terminal: false,
    card_terminal_mexican_cards_only: false,
  })
  const [bank, setBank] = useState({ bank_name: '', account_holder: '', clabe: '' })
  const [savedBank, setSavedBank] = useState(null)
  const [supportsDelivery, setSupportsDelivery] = useState(false)
  const [feeMode, setFeeMode] = useState('driver') // 'driver' | 'free' | 'fixed'
  const [feeAmount, setFeeAmount] = useState('')
  const [openingHours, setOpeningHours] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase
        .from('restaurants')
        .select('logo_url, accepts_cash, accepts_transfer, accepts_card_terminal, card_terminal_mexican_cards_only, opening_hours, supports_delivery, delivery_fee')
        .eq('id', profile.restaurant_id)
        .single(),
      supabase.from('restaurant_payment_details').select('bank_name, account_holder, clabe').eq('restaurant_id', profile.restaurant_id).maybeSingle(),
    ]).then(([{ data }, { data: bankData }]) => {
      if (data) {
        setLogoUrl(data.logo_url || '')
        setSupportsDelivery(Boolean(data.supports_delivery))
        if (data.delivery_fee === null || data.delivery_fee === undefined) setFeeMode('driver')
        else if (Number(data.delivery_fee) === 0) setFeeMode('free')
        else {
          setFeeMode('fixed')
          setFeeAmount(String(Number(data.delivery_fee)))
        }
        setOpeningHours(data.opening_hours ?? null)
        setPayment({
          accepts_cash: data.accepts_cash,
          accepts_transfer: data.accepts_transfer,
          accepts_card_terminal: data.accepts_card_terminal,
          card_terminal_mexican_cards_only: data.card_terminal_mexican_cards_only,
        })
      }
      const b = { bank_name: bankData?.bank_name || '', account_holder: bankData?.account_holder || '', clabe: bankData?.clabe || '' }
      setBank(b)
      setSavedBank(b)
      setLoading(false)
    })
  }, [profile.restaurant_id])

  const setBankField = (key) => (e) => {
    setSaved(false)
    setError(null)
    const v = key === 'clabe' ? e.target.value.replace(/[^\d\s]/g, '').slice(0, 22) : e.target.value
    setBank((b) => ({ ...b, [key]: v }))
  }

  const setPay = (key) => (value) => {
    setSaved(false)
    setPayment((p) => ({ ...p, [key]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSaved(false)
    if (!payment.accepts_cash && !payment.accepts_transfer && !payment.accepts_card_terminal) {
      setError('Activa al menos una forma de pago; si no, los clientes no podrán pedir.')
      return
    }
    const clabe = bank.clabe.replace(/\s/g, '')
    const bankChanged =
      bank.bank_name.trim() !== savedBank.bank_name || bank.account_holder.trim() !== savedBank.account_holder || clabe !== savedBank.clabe
    if (payment.accepts_transfer && !/^\d{18}$/.test(clabe)) {
      setError('Para recibir transferencias escribe tu CLABE de 18 dígitos.')
      return
    }
    if (clabe && !/^\d{18}$/.test(clabe)) {
      setError('La CLABE debe tener 18 dígitos.')
      return
    }
    if (payment.accepts_transfer && !bank.account_holder.trim()) {
      setError('Escribe el nombre del titular de la cuenta.')
      return
    }
    let deliveryFee = null
    if (feeMode === 'free') deliveryFee = 0
    if (feeMode === 'fixed') {
      deliveryFee = Number(String(feeAmount).replace(',', '.'))
      if (!Number.isFinite(deliveryFee) || deliveryFee <= 0 || deliveryFee > 1000) {
        setError('Escribe el costo de envío, por ejemplo 35.')
        return
      }
      deliveryFee = Math.round(deliveryFee * 100) / 100
    }
    if (hoursErrors(openingHours).length > 0) {
      setError('Corrige el horario antes de guardar.')
      return
    }
    setSaving(true)
    // orders_paused is deliberately not saved here: it's switched live from
    // Pedidos, and saving this form must never undo a pause.
    const patch = { logo_url: logoUrl.trim() || null, ...payment, opening_hours: normalizeHours(openingHours) }
    if (supportsDelivery) patch.delivery_fee = deliveryFee
    // Bank first: turning transfers on with no CLABE saved would leave
    // customers without the account to pay to.
    if (bankChanged) {
      const nextBank = { bank_name: bank.bank_name.trim(), account_holder: bank.account_holder.trim(), clabe }
      const { error: bankError } = await supabase.from('restaurant_payment_details').upsert({
        restaurant_id: profile.restaurant_id,
        bank_name: nextBank.bank_name || null,
        account_holder: nextBank.account_holder || null,
        clabe: nextBank.clabe || null,
      })
      if (bankError) {
        setSaving(false)
        setError('No se pudieron guardar tus datos bancarios. Intenta de nuevo.')
        return
      }
      setSavedBank(nextBank)
      setBank(nextBank)
    }
    const { error: updateError } = await supabase.from('restaurants').update(patch).eq('id', profile.restaurant_id)
    setSaving(false)
    if (updateError) {
      setError('No se pudo guardar. Intenta de nuevo.')
      return
    }
    setRestaurant?.((r) => (r ? { ...r, logo_url: patch.logo_url, opening_hours: patch.opening_hours } : r))
    setSaved(true)
  }

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-2xl bg-sea-950/[0.06]" />
        ))}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="pb-24">
      <PageHeader title="Ajustes" sub="Lo que cambies aquí lo ven tus clientes al guardar." />

      <div className="space-y-5">
        <Panel title="Avisos de pedidos" sub="Para que no se te pase ningún pedido.">
          <PhoneAlerts />
        </Panel>

        <Panel title="Horario" sub="Fuera de este horario los clientes ven tu menú pero no pueden pedir.">
          <HoursEditor
            value={openingHours}
            onChange={(v) => {
              setSaved(false)
              setOpeningHours(v)
            }}
          />
        </Panel>

        <Panel title="Formas de pago" sub="Lo que el cliente puede elegir al confirmar su pedido.">
          <div className="space-y-4">
            <Toggle checked={payment.accepts_cash} onChange={setPay('accepts_cash')} label="Efectivo" sub="Paga al recibir su pedido" />
            <Toggle
              checked={payment.accepts_transfer}
              onChange={setPay('accepts_transfer')}
              label="Transferencia"
              sub="Ve tus datos bancarios y te manda el comprobante por WhatsApp"
            />
            {payment.accepts_transfer && (
              <div className="space-y-3 rounded-xl bg-salt p-3.5">
                <p className="text-sm text-sea-950/65">Tus clientes ven estos datos solo después de pedir con transferencia.</p>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold">CLABE (18 dígitos)</span>
                  <input
                    inputMode="numeric"
                    autoComplete="off"
                    value={bank.clabe}
                    onChange={setBankField('clabe')}
                    placeholder="000000000000000000"
                    className={`${inputClass} tabular-nums tracking-wide`}
                  />
                  <span className="mt-1 block text-xs font-semibold tabular-nums text-sea-950/50">{bank.clabe.replace(/\D/g, '').length}/18</span>
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-semibold">Titular de la cuenta</span>
                    <input value={bank.account_holder} onChange={setBankField('account_holder')} className={inputClass} />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-semibold">Banco</span>
                    <input value={bank.bank_name} onChange={setBankField('bank_name')} placeholder="Ej. BBVA" className={inputClass} />
                  </label>
                </div>
                {savedBank?.clabe && bank.clabe.replace(/\s/g, '') !== savedBank.clabe && (
                  <p className="rounded-lg bg-mango-400/25 px-3 py-2 text-sm font-semibold">Revisa bien la CLABE: los clientes te pagarán a esta cuenta.</p>
                )}
              </div>
            )}
            <Toggle checked={payment.accepts_card_terminal} onChange={setPay('accepts_card_terminal')} label="Tarjeta" sub="Cobras en persona con tu terminal" />
            {payment.accepts_card_terminal && (
              <div className="ml-1 border-l-2 border-sea-950/10 pl-4">
                <Toggle
                  checked={payment.card_terminal_mexican_cards_only}
                  onChange={setPay('card_terminal_mexican_cards_only')}
                  label="Solo tarjetas mexicanas"
                  sub="Avisamos a los clientes extranjeros antes de pedir"
                />
              </div>
            )}
          </div>
        </Panel>

        {supportsDelivery && (
          <Panel title="Costo de envío" sub="El cliente lo ve antes de pedir y se suma al total.">
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                { value: 'fixed', label: 'Costo fijo', sub: 'Mismo precio para todos' },
                { value: 'free', label: 'Envío gratis', sub: 'No se cobra envío' },
                { value: 'driver', label: 'Lo dice el repartidor', sub: 'Se cobra al entregar' },
              ].map((o) => (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={feeMode === o.value}
                  onClick={() => {
                    setSaved(false)
                    setFeeMode(o.value)
                  }}
                  className={`rounded-xl p-3 text-left transition ${
                    feeMode === o.value ? 'bg-sea-950 text-white' : 'bg-white ring-1 ring-sea-950/15 hover:ring-sea-950/30'
                  }`}
                >
                  <span className="block font-bold">{o.label}</span>
                  <span className={`block text-xs ${feeMode === o.value ? 'text-white/70' : 'text-sea-950/55'}`}>{o.sub}</span>
                </button>
              ))}
            </div>
            {feeMode === 'fixed' && (
              <label className="mt-4 block max-w-48">
                <span className="mb-1.5 block text-sm font-semibold">Costo de envío</span>
                <span className="relative block">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-sea-950/50">$</span>
                  <input
                    inputMode="decimal"
                    value={feeAmount}
                    onChange={(e) => {
                      setSaved(false)
                      setFeeAmount(e.target.value)
                    }}
                    placeholder="35"
                    className={`${inputClass} pl-7 tabular-nums`}
                  />
                </span>
              </label>
            )}
          </Panel>
        )}

        <Panel title="Logo" sub="Aparece en tu tarjeta de la página principal y en tu menú.">
          <PhotoPicker
            label="Tu logo"
            value={logoUrl}
            onChange={(url) => {
              setSaved(false)
              setLogoUrl(url)
            }}
            restaurantId={profile.restaurant_id}
            kind="logo"
          />
        </Panel>
      </div>

      <div className="fixed inset-x-0 bottom-16 z-20 border-t border-sea-950/10 bg-salt/95 px-4 py-3 backdrop-blur md:bottom-0">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-end gap-3">
          {error && (
            <p role="alert" className="mr-auto text-sm font-semibold text-chili-500">
              {error}
            </p>
          )}
          {saved && (
            <p role="status" className="mr-auto inline-flex items-center gap-1.5 text-sm font-bold text-tide-500">
              <Check size={16} strokeWidth={3} aria-hidden="true" />
              Cambios guardados
            </p>
          )}
          <Button type="submit" size="lg" disabled={saving} className="min-w-44">
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </div>
      </div>
    </form>
  )
}

export default SettingsPage
