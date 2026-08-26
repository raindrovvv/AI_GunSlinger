export type Locale = 'ko' | 'en'

export function parseLocale(value: unknown): Locale {
  return value === 'en' ? 'en' : 'ko'
}
