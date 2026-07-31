import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../context/AuthContext.jsx'

function SettingsPage() {
  const { profile } = useAuth()
  const [logoUrl, setLogoUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase
      .from('restaurants')
      .select('logo_url')
      .eq('id', profile.restaurant_id)
      .single()
      .then(({ data }) => {
        setLogoUrl(data?.logo_url || '')
        setLoading(false)
      })
  }, [profile.restaurant_id])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSaved(false)
    setSaving(true)

    const { error: updateError } = await supabase
      .from('restaurants')
      .update({ logo_url: logoUrl || null })
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
    <form onSubmit={handleSubmit} className="max-w-lg space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
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
