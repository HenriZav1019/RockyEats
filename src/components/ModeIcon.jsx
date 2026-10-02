import { Bike, ShoppingBag, UtensilsCrossed } from 'lucide-react'

// One icon per order type, used everywhere the type appears.
export const MODE_ICONS = {
  dine_in: UtensilsCrossed,
  delivery: Bike,
  pickup: ShoppingBag,
}

export const MODES = [
  { key: 'dine_in', flag: 'supports_dine_in' },
  { key: 'delivery', flag: 'supports_delivery' },
  { key: 'pickup', flag: 'supports_pickup' },
]

function ModeIcon({ mode, size = 16, ...props }) {
  const Icon = MODE_ICONS[mode]
  return Icon ? <Icon size={size} strokeWidth={2.25} aria-hidden="true" {...props} /> : null
}

export default ModeIcon
