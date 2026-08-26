import { TOTAL_ROUNDS } from '../../shared/game'
import type { CareerStats, GamePhase, Opponent, PerkId, RunRecord } from '../types'

export const PREVIEW_PERKS: PerkId[] = ['fast', 'keen', 'silver', 'golden_spur']

export const PREVIEW_BOSS: Opponent = {
  id: 'boss-9',
  name: '엘 카란자',
  alias: '그림자 없는 마지막 무법자',
  bounty: 50000,
  crime: '국경 지대 연쇄 살인 및 현상금 사냥꾼 전멸',
  appearance: '칠흑 같은 가죽 코트와 붉은 눈빛의 전설적인 총잡이',
  baseReactionMs: 270,
  baseAccuracy: 0.88,
  tell: '오른쪽 검지 손가락을 미세하게 튕김',
  personality: '냉혹하고 침착함',
  taunt: '내 총구를 보고도 살아남은 자는 없다.',
}

export type PreviewKind = 'round' | 'duel9' | 'cutscene' | 'victory' | 'defeat'

export interface PreviewState {
  kind: PreviewKind
  phase: GamePhase
  round: number
  opponent: Opponent | null
}

export function parsePreviewSearch(search: string): PreviewState | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(search)
  const preview = params.get('preview')
  const roundParam = params.get('round')
  const parsedRound = roundParam ? parseInt(roundParam, 10) : NaN

  if (parsedRound >= 1 && parsedRound <= TOTAL_ROUNDS) {
    return { kind: 'round', phase: 'duel', round: parsedRound, opponent: null }
  }

  const flag =
    preview === 'duel9' || preview === 'boss' || search.includes('duel9')
      ? 'duel9'
      : preview === 'cutscene' || search.includes('cutscene')
        ? 'cutscene'
        : preview === 'victory' || search.includes('ending')
          ? 'victory'
          : preview === 'defeat'
            ? 'defeat'
            : null

  if (!flag) return null

  if (flag === 'duel9') {
    return { kind: 'duel9', phase: 'duel', round: TOTAL_ROUNDS, opponent: PREVIEW_BOSS }
  }
  if (flag === 'cutscene') {
    return { kind: 'cutscene', phase: 'cutscene', round: TOTAL_ROUNDS, opponent: null }
  }
  if (flag === 'victory') {
    return { kind: 'victory', phase: 'victory', round: TOTAL_ROUNDS, opponent: null }
  }
  return { kind: 'defeat', phase: 'gameover', round: TOTAL_ROUNDS, opponent: null }
}

export function previewCareer(): CareerStats {
  return {
    runs: 5,
    victories: 2,
    defeats: 3,
    totalWins: 28,
    totalPeaces: 4,
    bestBounty: 248500,
    bestReactionMs: 214,
    bestStreak: 9,
    recent: [],
  }
}

export function previewRun(kind: PreviewKind): RunRecord {
  const defeat = kind === 'defeat'
  return {
    id: 'preview-run',
    at: Date.now(),
    victory: !defeat,
    wins: defeat ? 4 : 8,
    peaces: 1,
    bounty: 248500,
    bestReactionMs: 214,
    bestStreak: defeat ? 4 : 9,
    roundsReached: defeat ? 5 : 9,
    perks: [...PREVIEW_PERKS],
  }
}
