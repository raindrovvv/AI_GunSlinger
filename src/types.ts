import type { Mood } from '../shared/mood'

export type GamePhase =
  | 'title'
  | 'loading'
  | 'wanted'
  | 'standoff'
  | 'duel'
  | 'newspaper'
  | 'store'
  | 'cutscene'
  | 'victory'
  | 'gameover'

export type MoodShift = Mood

/**
 * 초상화 에셋 식별자. api/_lib/rules.ts의 PORTRAIT_IDS와 같은 목록이며,
 * 런타임 배열과 파일 경로는 src/data/portraits.ts에 있다.
 */
export type PortraitId =
  | 'young_cowboy'
  | 'veiled_widow'
  | 'gold_tooth_swindler'
  | 'masked_poncho'
  | 'bespectacled_gunman'
  | 'talisman_woman'
  | 'fallen_sheriff'
  | 'mechanical_arm'
  /** 최종보스 전용. 서버가 고를 수 없고 최종 라운드에서만 쓰인다. */
  | 'final_boss'
  | 'young_male'
  | 'middle_male'
  | 'elder_male'
  | 'young_female'
  | 'middle_female'
  | 'masked_bandit'

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
  /** 서버가 골라준 초상화. 없으면 클라이언트가 외모 문장으로 추정한다. */
  portrait?: PortraitId | null
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
  bossScore?: {
    playerWins: number
    enemyWins: number
    totalSets: number
    setHistory: Array<{
      setNum: number
      winner: 'player' | 'enemy'
      reactionMs: number | null
      headshot: boolean
    }>
  }
}

export type PerkId =
  | 'steady'
  | 'keen'
  | 'fast'
  | 'silver'
  | 'charm'
  | 'second_chance'
  | 'golden_spur'
  | 'poker_face'

export interface Perk {
  id: PerkId
  name: string
  desc: string
}

export type ConsumableId = 'whiskey' | 'smoke' | 'powder' | 'bible' | 'intel'

export interface ConsumableItem {
  id: ConsumableId
  name: string
  desc: string
  price: number
  icon: string
  tag: '대치' | '결투' | '정보'
}

export interface ActiveBuffs {
  whiskey?: boolean
  smoke?: boolean
  powder?: boolean
  bible?: boolean
  intel?: boolean
}
