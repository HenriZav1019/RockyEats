// Building blocks for the staff side (dashboard + admin), matching the
// customer app's tokens: white panels on salt, navy ink, orange actions.

export function PageHeader({ title, sub, actions }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="condensed text-[2.25rem] font-extrabold leading-none">{title}</h1>
        {sub && <p className="mt-1.5 text-sm text-sea-950/60">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Panel({ title, sub, children, className = '' }) {
  return (
    <section className={`rounded-2xl bg-white p-4 ring-1 ring-sea-950/10 sm:p-5 ${className}`}>
      {title && (
        <div className="mb-4">
          <h2 className="text-lg font-bold leading-tight">{title}</h2>
          {sub && <p className="mt-1 text-sm text-sea-950/60">{sub}</p>}
        </div>
      )}
      {children}
    </section>
  )
}

const BUTTON_TONES = {
  primary: 'bg-sun-500 text-white hover:bg-sun-600',
  dark: 'bg-sea-950 text-white hover:bg-sea-800',
  ghost: 'bg-white text-sea-950 ring-1 ring-sea-950/15 hover:ring-sea-950/30',
  success: 'bg-tide-500 text-white hover:brightness-95',
  danger: 'bg-white text-chili-500 ring-1 ring-chili-500/30 hover:bg-chili-500/5',
}

export function Button({ tone = 'primary', size = 'md', className = '', children, ...props }) {
  const sizes = { sm: 'h-9 px-3 text-sm', md: 'h-11 px-4 text-sm', lg: 'h-14 px-5 text-base' }
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-bold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${sizes[size]} ${BUTTON_TONES[tone]} ${className}`}
    >
      {children}
    </button>
  )
}

// iOS-style switch for on/off settings that apply immediately.
export function Toggle({ checked, onChange, label, sub, disabled }) {
  return (
    <label className={`flex items-center justify-between gap-4 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        {sub && <span className="block text-sm text-sea-950/55">{sub}</span>}
      </span>
      <span className="relative inline-flex shrink-0">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="h-7 w-12 rounded-full bg-sea-950/20 transition peer-checked:bg-tide-500 peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-mango-400" />
        <span className="absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  )
}

export function StatusPill({ className = '', children }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${className}`}>{children}</span>
}

export function EmptyState({ title, children }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-sea-950/15 px-6 py-12 text-center">
      <p className="text-lg font-bold">{title}</p>
      {children && <div className="mx-auto mt-1.5 max-w-sm text-sm text-sea-950/60">{children}</div>}
    </div>
  )
}

export function Segmented({ options, value, onChange, label }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex rounded-xl bg-sea-950/[0.06] p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex h-9 items-center gap-2 rounded-lg px-3.5 text-sm font-bold transition ${
            value === o.value ? 'bg-white text-sea-950 shadow-sm' : 'text-sea-950/60 hover:text-sea-950'
          }`}
        >
          {o.label}
          {o.count !== undefined && (
            <span
              className={`min-w-5 rounded-full px-1.5 text-xs tabular-nums ${
                value === o.value ? 'bg-sun-500 text-white' : 'bg-sea-950/10'
              }`}
            >
              {o.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
