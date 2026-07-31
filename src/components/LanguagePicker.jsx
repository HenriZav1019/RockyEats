import { useLanguage } from '../context/LanguageContext.jsx'

function LanguagePicker() {
  const { setLanguage } = useLanguage()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-sunset-500 via-coral-500 to-ocean-600 px-4">
      <div className="animate-pop-in w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
        <p className="text-4xl">🌅</p>
        <h1 className="mt-2 font-display text-xl font-bold text-ocean-900">
          Elige tu idioma / Choose your language
        </h1>

        <div className="mt-5 space-y-3">
          <button
            type="button"
            onClick={() => setLanguage('es')}
            className="w-full rounded-full bg-sunset-500 px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:scale-105 hover:bg-sunset-600 active:scale-95"
          >
            🇲🇽 Español
          </button>
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className="w-full rounded-full bg-ocean-600 px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:scale-105 hover:bg-ocean-700 active:scale-95"
          >
            🇺🇸 English
          </button>
        </div>
      </div>
    </div>
  )
}

export default LanguagePicker
