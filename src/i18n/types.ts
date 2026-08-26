export type Locale = 'ko' | 'en'

export type Translator = (key: string, vars?: Record<string, string | number>) => string
