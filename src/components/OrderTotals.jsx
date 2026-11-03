import { formatMoney } from '../lib/format.js'
import { feeLabel } from '../lib/deliveryFee.js'

// Subtotal / Envío / Total block used by cart, checkout and the order ticket.
// `fee` is { known, fee } from deliveryFeeFor(), or null while it loads.
function OrderTotals({ subtotal, mode, fee, t, big = false }) {
  const delivery = mode === 'delivery'
  const total = subtotal + (fee?.known ? fee.fee : 0)
  return (
    <div className="mt-3 border-t-2 border-sea-950 pt-3">
      {delivery && (
        <dl className="mb-2 space-y-1 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-sea-950/65">{t('fee.subtotal')}</dt>
            <dd className="tabular-nums">{formatMoney(subtotal)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-sea-950/65">{t('fee.delivery')}</dt>
            <dd className={`tabular-nums ${fee?.known && fee.fee === 0 ? 'font-bold text-tide-500' : ''}`}>
              {fee ? feeLabel(fee, t) : '…'}
            </dd>
          </div>
        </dl>
      )}
      <div className="flex items-baseline justify-between">
        <span className={big ? 'text-lg font-bold' : 'font-bold'}>{t('cart.total')}</span>
        <span className={`condensed font-extrabold tabular-nums ${big ? 'text-3xl' : 'text-2xl'}`}>{formatMoney(total)}</span>
      </div>
    </div>
  )
}

export default OrderTotals
