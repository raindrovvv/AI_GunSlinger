import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { interpolate, MESSAGES } from './messages'
import { loadLocale, saveLocale } from './storage'
import type { Locale, Translator } from './types'

type LocaleContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: Translator
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(loadLocale)

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    saveLocale(next)
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const t = useCallback<Translator>(
    (key, vars) => interpolate(MESSAGES[locale][key] ?? MESSAGES.ko[key] ?? key, vars),
    [locale],
  )

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t])

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used inside LocaleProvider')
  return ctx
}

export function useT() {
  return useLocale().t
}
