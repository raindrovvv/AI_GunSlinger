export type GamePhase =
  | 'title'
  | 'loading'
  | 'wanted'
  | 'standoff'
  | 'duel'
  | 'newspaper'
  | 'victory'
  | 'gameover'

export type MoodShift = 'intimidated' | 'angered' | 'calm' | 'scared' | 'suspicious'

export interface Opponent {
  id: string
  name: string
  alias: string
  bounty: number
  crime: string
  appearance: string
  tell: string
  personality: string
  taunt: string
  baseReactionMs: number
  baseAccuracy: number
}

export interface DuelMods {
  reactionDeltaMs: number
  accuracyDelta: number
  mood: MoodShift
  peaceEnding: boolean
}

export interface ChatMessage {
  role: 'player' | 'opponent' | 'system'
  text: string
}

export interface NewspaperArticle {
  headline: string
  body: string
  quote: string
}

export interface GameStats {
  round: number
  wins: number
  peaces: number
  usedAi: boolean
}

/** 한 번의 런(시작~승리/패배) 결과 */
export interface RunRecord {
  id: string
  at: number
  victory: boolean
  wins: number
  peaces: number
  bounty: number
  bestReactionMs: number | null
  bestStreak: number
  roundsReached: number
  perks: PerkId[]
}

/** localStorage에 쌓이는 커리어 전적 */
export interface CareerStats {
  runs: number
  victories: number
  defeats: number
  totalWins: number
  totalPeaces: number
  bestBounty: number
  bestReactionMs: number | null
  bestStreak: number
  recent: RunRecord[]
}

export type DrawGrade = 'S' | 'A' | 'B' | 'C' | '-'

export interface DuelOutcome {
  won: boolean
  detail: string
  reactionMs: number | null
  grade: DrawGrade
  headshot: boolean
  foul: boolean
}

export type PerkId = 'steady' | 'keen' | 'fast' | 'silver' | 'charm'

export interface Perk {
  id: PerkId
  name: string
  desc: string
}
