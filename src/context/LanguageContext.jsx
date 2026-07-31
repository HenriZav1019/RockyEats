import { createContext, useContext, useEffect, useState } from 'react'
import { translations } from '../lib/translations.js'

const LanguageContext = createContext(null)
const STORAGE_KEY = 'rockyeats_lang'

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => localStorage.getItem(STORAGE_KEY))

  useEffect(() => {
    if (language) localStorage.setItem(STORAGE_KEY, language)
  }, [language])

  const setLanguage = (lang) => setLanguageState(lang)

  const t = (key) => translations[language || 'es'][key] ?? key

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}
