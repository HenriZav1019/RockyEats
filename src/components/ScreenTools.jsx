import { useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { isAudioUnlocked, unlockAudio } from '../lib/chime.js'

// Header strip for the dark kitchen/bar/queue screens: title, live counts,
// a clock you can read from across the kitchen, and the sound switch.
export function ScreenHeader({ title, children, now }) {
  const [sound, setSound] = useState(isAudioUnlocked())
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="condensed text-[2.5rem] font-extrabold leading-none">{title}</h1>
        {children}
      </div>
      <div className="flex items-center gap-2">
        <span className="condensed text-3xl font-extrabold tabular-nums text-white/80">
          {now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })}
        </span>
        <button
          type="button"
          onClick={async () => setSound(await unlockAudio())}
          className={`inline-flex h-11 items-center gap-2 rounded-xl px-3.5 text-sm font-bold transition ${
            sound ? 'bg-white/10 text-white/80' : 'bg-mango-400 text-sea-950 animate-pulse'
          }`}
        >
          {sound ? <Volume2 size={18} aria-hidden="true" /> : <VolumeX size={18} aria-hidden="true" />}
          {sound ? 'Sonido activo' : 'Activar sonido'}
        </button>
      </div>
    </div>
  )
}

export const WAIT_BORDER = { ok: 'border-white/15', slow: 'border-mango-400', late: 'border-chili-500' }
export const WAIT_TEXT = { ok: 'text-white/70', slow: 'text-mango-400', late: 'text-chili-400' }
