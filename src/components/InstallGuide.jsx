import { useEffect, useState } from 'react'
import { Check, Download, EllipsisVertical, Share, Smartphone, SquarePlus, X } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext.jsx'
import { detectPlatform, isInAppBrowser, useInstall } from '../lib/install.js'
import logo from '../assets/rockyeats-logo.png'

// Inline icon chip so each step shows exactly what to look for on screen.
function Key({ icon: Icon, children }) {
  return (
    <span className="mx-0.5 inline-flex items-center gap-1 rounded-md bg-sea-950/[0.07] px-1.5 py-0.5 align-middle text-[0.85em] font-bold">
      {Icon && <Icon size={14} strokeWidth={2.5} aria-hidden="true" />}
      {children}
    </span>
  )
}

function Steps({ steps }) {
  return (
    <ol className="space-y-3">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sea-950 text-sm font-bold text-white">{i + 1}</span>
          <p className="pt-0.5 text-[0.95rem] leading-snug">{step}</p>
        </li>
      ))}
    </ol>
  )
}

function InstallSheet({ onClose, initialTab, canPrompt, onPrompt }) {
  const { t } = useLanguage()
  const [tab, setTab] = useState(initialTab)
  const inApp = isInAppBrowser()

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const ios = [
    <>
      {t('install.ios1')} <Key icon={Share}>{t('install.share')}</Key> {t('install.ios1b')} <Key>···</Key>
    </>,
    <>
      {t('install.ios2')} <Key icon={SquarePlus}>{t('install.ios2key')}</Key>
    </>,
    <>
      {t('install.ios3')} <Key>{t('install.add')}</Key>
    </>,
  ]
  const android = [
    <>
      {t('install.and1')} <Key icon={EllipsisVertical}>{t('install.menu')}</Key>
    </>,
    <>
      {t('install.and2')} <Key icon={Download}>{t('install.and2key')}</Key> {t('install.or')} <Key icon={SquarePlus}>{t('install.and2key2')}</Key>
    </>,
    <>
      {t('install.and3')} <Key>{t('install.install')}</Key>
    </>,
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-sea-950/60 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-title"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-salt p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-sea-950 sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src={logo} alt="" className="h-14 w-14 rounded-2xl object-cover shadow-md" />
            <div>
              <h2 id="install-title" className="condensed text-3xl font-extrabold leading-none">{t('install.title')}</h2>
              <p className="mt-1 text-sm text-sea-950/65">{t('install.subtitle')}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label={t('install.close')} className="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-sea-950/5">
            <X size={20} />
          </button>
        </div>

        {canPrompt && (
          <button
            type="button"
            onClick={onPrompt}
            className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-sun-500 text-base font-bold text-white transition hover:bg-sun-600"
          >
            <Download size={20} strokeWidth={2.5} aria-hidden="true" />
            {t('install.oneTap')}
          </button>
        )}

        {inApp && (
          <p className="mt-5 rounded-xl bg-mango-400/25 px-3.5 py-3 text-sm font-semibold">{t('install.inApp')}</p>
        )}

        <div role="tablist" aria-label={t('install.title')} className="mt-5 grid grid-cols-2 gap-1 rounded-xl bg-sea-950/[0.06] p-1">
          {[
            { key: 'ios', label: 'iPhone' },
            { key: 'android', label: 'Android' },
          ].map((o) => (
            <button
              key={o.key}
              type="button"
              role="tab"
              aria-selected={tab === o.key}
              onClick={() => setTab(o.key)}
              className={`h-10 rounded-lg text-sm font-bold transition ${tab === o.key ? 'bg-white shadow-sm' : 'text-sea-950/60'}`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div className="mt-5" role="tabpanel">
          {tab === 'ios' ? (
            <>
              <p className="mb-3 text-sm font-semibold text-sea-950/60">{t('install.iosBrowser')}</p>
              <Steps steps={ios} />
            </>
          ) : (
            <>
              <p className="mb-3 text-sm font-semibold text-sea-950/60">{t('install.androidBrowser')}</p>
              <Steps steps={android} />
            </>
          )}
        </div>

        <p className="mt-5 flex items-start gap-2 rounded-xl bg-white p-3.5 text-sm text-sea-950/75 ring-1 ring-sea-950/10">
          <Check size={17} strokeWidth={2.75} className="mt-0.5 shrink-0 text-tide-500" aria-hidden="true" />
          {t('install.done')}
        </p>
      </div>
    </div>
  )
}

// Small chip that opens the guide. Hidden once the site is already running as
// an installed app.
function InstallGuide({ tone = 'light', className = '' }) {
  const { t } = useLanguage()
  const { canPrompt, installed, prompt } = useInstall()
  const [open, setOpen] = useState(false)
  const platform = detectPlatform()

  if (installed) return null

  const onPrompt = async () => {
    const outcome = await prompt()
    if (outcome === 'accepted') setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition ${
          tone === 'dark' ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-white text-sea-950 ring-1 ring-sea-950/15 hover:ring-sea-950/30'
        } ${className}`}
      >
        <Smartphone size={17} strokeWidth={2.25} aria-hidden="true" />
        {t('install.button')}
      </button>
      {open && (
        <InstallSheet
          onClose={() => setOpen(false)}
          initialTab={platform === 'android' ? 'android' : 'ios'}
          canPrompt={canPrompt}
          onPrompt={onPrompt}
        />
      )}
    </>
  )
}

export default InstallGuide
