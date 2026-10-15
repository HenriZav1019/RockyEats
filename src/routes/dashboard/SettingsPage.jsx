import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Check } from 'lucide-react'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../context/AuthContext.jsx'
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
  const [bank, setBank] = useState(null)
  const [openingHours, setOpeningHours] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase
        .from('restaurants')
        .select('logo_url, accepts_cash, accepts_transfer, accepts_card_terminal, card_terminal_mexican_cards_only, opening_hours')
        .eq('id', profile.restaurant_id)
        .single(),
      supabase.from('restaurant_payment_details').select('bank_name, account_holder, clabe').eq('restaurant_id', profile.restaurant_id).maybeSingle(),
    ]).then(([{ data }, { data: bankData }]) => {
      if (data) {
        setLogoUrl(data.logo_url || '')
        setOpeningHours(data.opening_hours ?? null)
        setPayment({
          accepts_cash: data.accepts_cash,
          accepts_transfer: data.accepts_transfer,
          accepts_card_terminal: data.accepts_card_terminal,
          card_terminal_mexican_cards_only: data.card_terminal_mexican_cards_only,
        })
      }
      setBank(bankData || null)
      setLoading(false)
    })
  }, [profile.restaurant_id])

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
    if (hoursErrors(openingHours).length > 0) {
      setError('Corrige el horario antes de guardar.')
      return
    }
    setSaving(true)
    // orders_paused is deliberately not saved here: it's switched live from
    // Pedidos, and saving this form must never undo a pause.
    const patch = { logo_url: logoUrl.trim() || null, ...payment, opening_hours: normalizeHours(openingHours) }
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
              <div className="rounded-xl bg-salt p-3.5 text-sm">
                {bank?.clabe ? (
                  <p>
                    <span className="font-semibold">{bank.bank_name || 'Banco'}</span>, {bank.account_holder}
                    <br />
                    <span className="tabular-nums">CLABE {bank.clabe}</span>
                  </p>
                ) : (
                  <p className="font-semibold text-chili-500">Todavía no hay datos bancarios.</p>
                )}
                <p className="mt-1 text-sea-950/55">Para cambiar estos datos, pide al administrador de RockyEats que los actualice.</p>
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

        <Panel title="Logo" sub="Aparece en tu tarjeta de la página principal y en tu menú.">
          <div className="flex items-start gap-4">
            <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-salt ring-1 ring-sea-950/10">
              {logoUrl ? (
                <img src={logoUrl} alt="Vista previa del logo" className="h-full w-full object-contain p-1.5" />
              ) : (
                <span className="text-xs text-sea-950/40">Sin logo</span>
              )}
            </div>
            <label className="block flex-1">
              <span className="mb-1.5 block text-sm font-semibold">Enlace a la imagen</span>
              <input
                type="url"
                placeholder="https://…"
                value={logoUrl}
                onChange={(e) => {
                  setSaved(false)
                  setLogoUrl(e.target.value)
                }}
                className={inputClass}
              />
            </label>
          </div>
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
