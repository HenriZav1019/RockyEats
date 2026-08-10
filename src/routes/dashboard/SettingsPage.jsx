import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../context/AuthContext.jsx'

function Checkbox({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-1.5 text-sm text-gray-700">
      <input type="checkbox" checked={checked} onChange={onChange} />
      {label}
    </label>
  )
}

function SettingsPage() {
  const { profile } = useAuth()
  const [logoUrl, setLogoUrl] = useState('')
  const [payment, setPayment] = useState({
    accepts_cash: true,
    accepts_transfer: false,
    accepts_card_terminal: false,
    card_terminal_mexican_cards_only: false,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase
      .from('restaurants')
      .select('logo_url, accepts_cash, accepts_transfer, accepts_card_terminal, card_terminal_mexican_cards_only')
      .eq('id', profile.restaurant_id)
      .single()
      .then(({ data }) => {
        setLogoUrl(data?.logo_url || '')
        if (data) {
          setPayment({
            accepts_cash: data.accepts_cash,
            accepts_transfer: data.accepts_transfer,
            accepts_card_terminal: data.accepts_card_terminal,
            card_terminal_mexican_cards_only: data.card_terminal_mexican_cards_only,
          })
        }
        setLoading(false)
      })
  }, [profile.restaurant_id])

  const setPaymentField = (key) => (e) => setPayment((p) => ({ ...p, [key]: e.target.checked }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSaved(false)
    setSaving(true)

    const { error: updateError } = await supabase
      .from('restaurants')
      .update({ logo_url: logoUrl || null, ...payment })
      .eq('id', profile.restaurant_id)

    setSaving(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setSaved(true)
  }

  if (loading) return <p className="text-gray-500">Loading…</p>

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-6">
      <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="font-medium text-gray-900">Restaurant logo</h2>
        <p className="text-sm text-gray-500">
          Paste a link to your logo image. It'll show up on your restaurant's card when customers
          browse restaurants.
        </p>

        <input
          type="url"
          placeholder="https://…"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />

        {logoUrl && (
          <img
            src={logoUrl}
            alt="Logo preview"
            className="h-20 w-20 rounded-lg border border-gray-200 object-contain p-1"
          />
        )}
      </div>

      <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="font-medium text-gray-900">Payment methods</h2>
        <p className="text-sm text-gray-500">Choose which payment methods customers can select at checkout.</p>
        <div className="flex flex-wrap gap-4">
          <Checkbox label="Cash" checked={payment.accepts_cash} onChange={setPaymentField('accepts_cash')} />
          <Checkbox
            label="Bank transfer"
            checked={payment.accepts_transfer}
            onChange={setPaymentField('accepts_transfer')}
          />
          <Checkbox
            label="Card terminal"
            checked={payment.accepts_card_terminal}
            onChange={setPaymentField('accepts_card_terminal')}
          />
        </div>

        {payment.accepts_card_terminal && (
          <div className="space-y-2 border-t border-gray-100 pt-3">
            <p className="text-sm text-gray-500">Which cards does your terminal accept?</p>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="radio"
                name="terminal-scope"
                checked={!payment.card_terminal_mexican_cards_only}
                onChange={() => setPayment((p) => ({ ...p, card_terminal_mexican_cards_only: false }))}
              />
              Any card (national or international)
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="radio"
                name="terminal-scope"
                checked={payment.card_terminal_mexican_cards_only}
                onChange={() => setPayment((p) => ({ ...p, card_terminal_mexican_cards_only: true }))}
              />
              Mexican cards only
            </label>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-emerald-600">Saved.</p>}

      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </form>
  )
}

export default SettingsPage
