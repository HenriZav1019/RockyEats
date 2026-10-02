import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { useLanguage } from '../../context/LanguageContext.jsx'
import { addPendingOrder } from '../../lib/pendingOrders.js'
import { BackLink, Field, Notice, PageTitle, PrimaryButton, inputClass } from '../../components/ui.jsx'

function TrackOrderPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [orderNumber, setOrderNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const { data, error: rpcError } = await supabase.rpc('lookup_order_by_number_and_phone', {
      p_order_number: orderNumber.trim(),
      p_phone: phone.trim(),
    })

    setSubmitting(false)

    if (rpcError || !data) {
      setError(t('track.notFound'))
      return
    }

    addPendingOrder({
      id: data.order.id,
      orderNumber: data.order.order_number,
      restaurantId: data.order.restaurant_id,
      restaurantName: data.restaurant?.name || '',
    })

    navigate(`/order-confirmation/${data.order.id}`, {
      state: { order: data.order, orderItems: data.order_items, restaurant: data.restaurant },
    })
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-3">
      <BackLink to="/">{t('menu.back')}</BackLink>
      <PageTitle sub={t('track.subtitle')}>{t('track.title')}</PageTitle>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <Field id="order-number" label={t('track.orderNumber')}>
          <input
            id="order-number"
            required
            placeholder="A1234"
            autoCapitalize="characters"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            className={`${inputClass} condensed text-xl font-bold uppercase tracking-wide`}
          />
        </Field>
        <Field id="track-phone" label={t('track.phone')}>
          <input
            id="track-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputClass}
          />
        </Field>
        {error && (
          <div role="alert">
            <Notice tone="error">{error}</Notice>
          </div>
        )}
        <PrimaryButton type="submit" disabled={submitting} className="justify-center">
          {submitting ? t('track.searching') : t('track.find')}
        </PrimaryButton>
      </form>
    </div>
  )
}

export default TrackOrderPage
