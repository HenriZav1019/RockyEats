// "$1,250" for whole amounts, "$95.50" otherwise. Prices are MXN.
export function formatMoney(value) {
  const n = Number(value) || 0
  const whole = Number.isInteger(Math.round(n * 100) / 100)
  return `$${n.toLocaleString('es-MX', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`
}

// Stable color for a restaurant's sign tile when it has no logo.
const SIGN_COLORS = [
  { bg: 'bg-sun-500', fg: 'text-white' },
  { bg: 'bg-tide-500', fg: 'text-white' },
  { bg: 'bg-mango-400', fg: 'text-sea-950' },
  { bg: 'bg-sea-800', fg: 'text-mango-400' },
  { bg: 'bg-chili-500', fg: 'text-white' },
]
export function signColors(seed = '') {
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return SIGN_COLORS[h % SIGN_COLORS.length]
}
