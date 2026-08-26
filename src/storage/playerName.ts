import { DEFAULT_PLAYER_NAME } from '../../shared/game'

export const PLAYER_NAME_KEY = 'ai-gunslinger.player-name'

export function loadStoredPlayerName(fallback = DEFAULT_PLAYER_NAME): string {
  try {
    return localStorage.getItem(PLAYER_NAME_KEY) || fallback
  } catch {
    return fallback
  }
}

export function loadPlayerNameDraft(): string {
  try {
    return localStorage.getItem(PLAYER_NAME_KEY) ?? ''
  } catch {
    return ''
  }
}

export function savePlayerName(name: string) {
  try {
    localStorage.setItem(PLAYER_NAME_KEY, name)
  } catch {
    /* private mode */
  }
}
