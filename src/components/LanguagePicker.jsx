import { useLanguage } from '../context/LanguageContext.jsx'
import wordmark from '../assets/rockyeats-wordmark-tight.webp'
import Sunset from './Sunset.jsx'

// First visit: bilingual by design, since the question has to be readable
// before we know the answer.
function LanguagePicker() {
  const { setLanguage } = useLanguage()
  const options = [
    { code: 'es', label: 'Español', sub: 'Continuar en español' },
    { code: 'en', label: 'English', sub: 'Continue in English' },
  ]
  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-sea-950 px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-10 text-white">
      <Sunset className="pointer-events-none absolute -right-16 top-16 w-[340px] opacity-90" />
      <img src={wordmark} alt="RockyEats" className="relative h-10 w-auto self-start" width="520" height="165" />
      <div className="relative mt-auto">
        <h1 className="condensed text-5xl font-extrabold leading-[0.9]">
          Elige tu idioma
          <span className="mt-2 block text-white/55">Choose your language</span>
        </h1>
        <div className="mt-8 space-y-3">
          {options.map((o) => (
            <button
              key={o.code}
              type="button"
              lang={o.code}
              onClick={() => setLanguage(o.code)}
              className="flex h-16 w-full items-center justify-between rounded-2xl bg-white px-5 text-left text-sea-950 transition hover:bg-sun-100 active:scale-[0.99]"
            >
              <span>
                <span className="block text-lg font-bold leading-tight">{o.label}</span>
                <span className="block text-sm text-sea-950/60">{o.sub}</span>
              </span>
              <span className="condensed text-2xl font-extrabold text-sun-500">{o.code.toUpperCase()}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default LanguagePicker
