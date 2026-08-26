export const TOTAL_ROUNDS = 9
export const FINAL_ROUND = TOTAL_ROUNDS
export const MAX_STANDOFF_TURNS = 3
export const FAME_STREAK_THRESHOLD = 2
export const DEFAULT_PLAYER_NAME = '이름 없는 총잡이'
export const PLAYER_NAME_MAX = 24

export function isFinalRound(round: number) {
  return round === FINAL_ROUND
}

export function normalizePlayerName(raw: unknown, maxLen = PLAYER_NAME_MAX): string {
  const s = typeof raw === 'string' ? raw.trim() : ''
  if (!s) return DEFAULT_PLAYER_NAME
  return s.slice(0, maxLen)
}
