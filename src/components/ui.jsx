import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

// Shared building blocks for the customer screens so spacing, inputs and the
// bottom action bar look the same everywhere.

export function BackLink({ to, children }) {
  return (
    <Link
      to={to}
      className="-ml-2 inline-flex h-10 items-center gap-1 rounded-full pl-1 pr-3 text-sm font-semibold text-sea-950/65 hover:text-sea-950"
    >
      <ChevronLeft size={20} aria-hidden="true" />
      {children}
    </Link>
  )
}

export function PageTitle({ children, sub }) {
  return (
    <div className="mt-1">
      <h1 className="condensed text-[2.5rem] font-extrabold leading-[0.95]">{children}</h1>
      {sub && <p className="mt-1.5 text-sm text-sea-950/65">{sub}</p>}
    </div>
  )
}

export function SectionTitle({ children, aside }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-lg font-bold">{children}</h2>
      {aside}
    </div>
  )
}

export const inputClass =
  'block h-12 w-full rounded-xl bg-white px-3.5 text-base text-sea-950 ring-1 ring-sea-950/15 placeholder:text-sea-950/40 focus:outline-none focus:ring-2 focus:ring-sun-500'

export function Field({ id, label, hint, optional, optionalLabel, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 flex items-baseline gap-2 text-sm font-semibold">
        {label}
        {optional && <span className="font-normal text-sea-950/50">{optionalLabel}</span>}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-sm text-sea-950/55">{hint}</p>}
    </div>
  )
}

// Fixed bottom bar with the page's main action. Pages add pb-28 so content
// isn't hidden behind it.
export function BottomBar({ children }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-sea-950/10 bg-salt/95 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
      <div className="mx-auto max-w-3xl">{children}</div>
    </div>
  )
}

export function PrimaryButton({ children, className = '', ...props }) {
  return (
    <button
      {...props}
      className={`flex h-14 w-full items-center justify-between gap-3 rounded-2xl bg-sun-500 px-5 text-base font-bold text-white shadow-[0_10px_30px_-10px_rgba(233,84,26,0.7)] transition hover:bg-sun-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-sea-950/25 disabled:shadow-none ${className}`}
    >
      {children}
    </button>
  )
}

export function Notice({ tone = 'info', children }) {
  const tones = {
    info: 'bg-sea-950/[0.06] text-sea-950/80',
    warn: 'bg-mango-400/20 text-sea-950',
    error: 'bg-chili-500/10 text-chili-500 font-semibold',
  }
  return <p className={`rounded-xl px-3.5 py-3 text-sm ${tones[tone]}`}>{children}</p>
}
