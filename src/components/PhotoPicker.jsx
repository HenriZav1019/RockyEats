import { useRef, useState } from 'react'
import { Camera, ImageOff, Link2, LoaderCircle, Trash2 } from 'lucide-react'
import { uploadPhoto } from '../lib/photos.js'
import { inputClass } from './ui.jsx'

// Photo field for staff screens: tap to take or pick a photo, it's shrunk and
// uploaded right away, and `onChange` receives the public URL. A small
// "pegar enlace" option stays for photos that are already online.
function PhotoPicker({ value, onChange, restaurantId, kind = 'menu', label = 'Foto' }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [showLink, setShowLink] = useState(false)
  const [broken, setBroken] = useState(false)
  const logo = kind === 'logo'

  const pick = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // so picking the same file again still fires
    if (!file) return
    setError(null)
    setBusy(true)
    try {
      const url = await uploadPhoto({ restaurantId, file, kind })
      setBroken(false)
      onChange(url)
    } catch (err) {
      console.warn('[photo upload]', err)
      setError(
        err?.message === 'PHOTO_NOT_IMAGE' || err?.message === 'PHOTO_UNREADABLE'
          ? 'Ese archivo no es una foto que podamos usar. Prueba con otra.'
          : 'No se pudo subir la foto. Revisa tu conexión e intenta de nuevo.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          aria-label={value ? 'Cambiar foto' : 'Subir foto'}
          className={`relative grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white ring-1 ring-sea-950/15 transition hover:ring-sea-950/35 ${
            value ? '' : 'border-2 border-dashed border-sea-950/20 ring-0'
          }`}
        >
          {value && !broken ? (
            <img
              src={value}
              alt=""
              onError={() => setBroken(true)}
              className={`h-full w-full ${logo ? 'object-contain p-1.5' : 'object-cover'}`}
            />
          ) : value && broken ? (
            <ImageOff size={24} className="text-sea-950/35" aria-hidden="true" />
          ) : (
            <Camera size={26} className="text-sea-950/40" aria-hidden="true" />
          )}
          {busy && (
            <span className="absolute inset-0 grid place-items-center bg-white/80">
              <LoaderCircle size={26} className="animate-spin text-sea-950" aria-hidden="true" />
            </span>
          )}
        </button>

        <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-sea-950 px-3.5 text-sm font-bold text-white transition hover:bg-sea-900 disabled:opacity-60"
          >
            <Camera size={16} strokeWidth={2.5} aria-hidden="true" />
            {busy ? 'Subiendo…' : value ? 'Cambiar foto' : 'Subir foto'}
          </button>
          <div className="flex flex-wrap gap-x-3">
            {value && !busy && (
              <button
                type="button"
                onClick={() => {
                  setBroken(false)
                  onChange('')
                }}
                className="inline-flex h-8 items-center gap-1 text-sm font-semibold text-chili-500"
              >
                <Trash2 size={14} aria-hidden="true" />
                Quitar
              </button>
            )}
            {!showLink && (
              <button type="button" onClick={() => setShowLink(true)} className="inline-flex h-8 items-center gap-1 text-sm font-semibold text-sea-950/55">
                <Link2 size={14} aria-hidden="true" />
                Pegar enlace
              </button>
            )}
          </div>
        </div>
      </div>

      {showLink && (
        <input
          type="url"
          value={value || ''}
          onChange={(e) => {
            setBroken(false)
            onChange(e.target.value)
          }}
          placeholder="https://…"
          aria-label="Enlace a la imagen"
          className={`${inputClass} mt-3`}
        />
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm font-semibold text-chili-500">
          {error}
        </p>
      )}
      <input ref={inputRef} type="file" accept="image/*" onChange={pick} className="hidden" />
    </div>
  )
}

export default PhotoPicker
