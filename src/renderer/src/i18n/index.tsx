import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import { STORAGE_KEYS, parseLanguage } from '../lib/storage'
import { en } from './en'
import { fr, type TranslationKey } from './fr'

export type Language = 'FR' | 'EN'

type I18nValue = {
  language: Language
  setLanguage: (language: Language) => void
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [language, setLanguage] = useState<Language>(() => {
    try {
      return parseLanguage(localStorage.getItem(STORAGE_KEYS.language))
    } catch {
      return 'FR'
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.language, JSON.stringify(language))
    } catch {
      // Storage can be unavailable; the UI still works.
    }

    document.documentElement.lang = language.toLowerCase()
  }, [language])

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>): string => {
      const dictionary = language === 'FR' ? fr : en
      const template: string = dictionary[key] ?? key
      if (!vars) return template

      return template.replace(/\{(\w+)\}/g, (match, name: string) =>
        vars[name] === undefined ? match : String(vars[name])
      )
    },
    [language]
  )

  const value = useMemo(() => ({ language, setLanguage, t }), [language, t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext)
  if (!value) throw new Error('useI18n must be used inside LanguageProvider')
  return value
}

export type { TranslationKey }
