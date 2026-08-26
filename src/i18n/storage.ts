import type { Locale } from './types'

export const LOCALE_KEY = 'ai-gunslinger.locale'

export function loadLocale(): Locale {
  try {
    const saved = localStorage.getItem(LOCALE_KEY)
    if (saved === 'en' || saved === 'ko') return saved
  } catch {
    /* ignore */
  }
  return 'ko'
}

export function saveLocale(locale: Locale) {
  try {
    localStorage.setItem(LOCALE_KEY, locale)
  } catch {
    /* ignore */
  }
}
