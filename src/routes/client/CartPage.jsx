import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Minus, NotebookPen, Plus } from 'lucide-react'
import { useCart } from '../../context/CartContext.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'
import { formatMoney } from '../../lib/format.js'
import ModeIcon from '../../components/ModeIcon.jsx'
import { BackLink, BottomBar, Notice, PageTitle, PrimaryButton } from '../../components/ui.jsx'

function CartLine({ item, onQuantity, onNotes, t }) {
  const [showNote, setShowNote] = useState(Boolean(item.notes))
  return (
    <li className="py-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-bold leading-snug">{item.name}</p>
          <p className="mt-0.5 text-sm text-sea-950/60 tabular-nums">
            {formatMoney(item.price)} {t('cart.each')}
          </p>
        </div>
        <div className="flex h-10 shrink-0 items-center rounded-full ring-1 ring-sea-950/15">
          <button
            type="button"
            onClick={() => onQuantity(item.quantity - 1)}
            aria-label={`${t('menu.removeOne')}: ${item.name}`}
            className="grid h-10 w-10 place-items-center rounded-full hover:bg-sea-950/5 active:scale-90"
          >
            <Minus size={17} strokeWidth={2.5} />
          </button>
          <span className="min-w-6 text-center font-bold tabular-nums">{item.quantity}</span>
          <button
            type="button"
            onClick={() => onQuantity(item.quantity + 1)}
            aria-label={`${t('menu.addOne')}: ${item.name}`}
            className="grid h-10 w-10 place-items-center rounded-full hover:bg-sea-950/5 active:scale-90"
          >
            <Plus size={17} strokeWidth={2.5} />
          </button>
        </div>
        <p className="w-20 shrink-0 pt-2 text-right font-bold tabular-nums">{formatMoney(item.price * item.quantity)}</p>
      </div>
      {showNote ? (
        <input
          type="text"
          value={item.notes}
          onChange={(e) => onNotes(e.target.value)}
          placeholder={t('cart.notesPlaceholder')}
          aria-label={`${t('cart.addNote')}: ${item.name}`}
          autoFocus={!item.notes}
          className="mt-3 h-11 w-full rounded-xl bg-salt px-3 text-sm ring-1 ring-sea-950/10 placeholder:text-sea-950/40 focus:outline-none focus:ring-2 focus:ring-sun-500"
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowNote(true)}
          className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-sea-800 hover:text-sea-950"
        >
          <NotebookPen size={15} strokeWidth={2.25} aria-hidden="true" />
          {t('cart.addNote')}
        </button>
      )}
    </li>
  )
}

function CartPage() {
  const { restaurantId } = useParams()
  const navigate = useNavigate()
  const { cart, updateQuantity, updateNotes, total } = useCart()
  const { t } = useLanguage()

  if (cart.restaurantId !== restaurantId || cart.items.length === 0) {
    return <Navigate to={`/r/${restaurantId}`} replace />
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-32 pt-3">
      <BackLink to={`/r/${restaurantId}`}>{t('cart.keepBrowsing')}</BackLink>
      <PageTitle sub={cart.restaurantName}>{t('cart.title')}</PageTitle>

      {cart.mode ? (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-white px-3.5 py-3 ring-1 ring-sea-950/10">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <ModeIcon mode={cart.mode} size={18} />
            {t(`mode.${cart.mode}.badge`)}
          </span>
          <Link to={`/r/${restaurantId}`} className="text-sm font-semibold text-sun-600 underline underline-offset-2">
            {t('cart.change')}
          </Link>
        </div>
      ) : (
        <div className="mt-4">
          <Notice tone="error">{t('cart.pickModeFirst')}</Notice>
        </div>
      )}

      <ul className="mt-2 divide-y divide-sea-950/10">
        {cart.items.map((item) => (
          <CartLine
            key={item.id}
            item={item}
            t={t}
            onQuantity={(q) => updateQuantity(item.id, q)}
            onNotes={(notes) => updateNotes(item.id, notes)}
          />
        ))}
      </ul>

      <div className="mt-2 flex items-baseline justify-between border-t-2 border-sea-950 pt-4">
        <span className="text-lg font-bold">{t('cart.total')}</span>
        <span className="condensed text-3xl font-extrabold tabular-nums">{formatMoney(total)}</span>
      </div>
      {cart.mode === 'delivery' && <p className="mt-2 text-sm text-sea-950/60">{t('cart.deliveryFeeShort')}</p>}

      <BottomBar>
        <PrimaryButton type="button" disabled={!cart.mode} onClick={() => navigate(`/r/${restaurantId}/checkout`)}>
          <span>{t('cart.continue')}</span>
          <span className="tabular-nums">{formatMoney(total)}</span>
        </PrimaryButton>
      </BottomBar>
    </div>
  )
}

export default CartPage
