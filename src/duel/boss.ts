import type { Translator } from '../i18n/types'
import type { DuelOutcome } from '../types'

export type BossSetRecord = {
  setNum: number
  winner: 'player' | 'enemy'
  reactionMs: number | null
  headshot: boolean
}

export interface BossMatch {
  set: number
  playerScore: number
  enemyScore: number
  history: BossSetRecord[]
}

export function createBossMatch(): BossMatch {
  return { set: 1, playerScore: 0, enemyScore: 0, history: [] }
}

export function bossReactionBonus(set: number, playerScore: number, enemyScore: number) {
  if (set === 2) return playerScore > enemyScore ? 25 : 10
  if (set === 3) return 45
  return 0
}

export function bossFeintChance(set: number) {
  if (set === 1) return 0.6
  if (set === 2) return 0.75
  return 0.85
}

export function nextSetBanner(nextSet: number, won: boolean, t: Translator) {
  if (nextSet === 2) {
    return won
      ? { title: t('boss.p2winT'), subtitle: t('boss.p2winS') }
      : { title: t('boss.p2loseT'), subtitle: t('boss.p2loseS') }
  }
  return { title: t('boss.p3T'), subtitle: t('boss.p3S') }
}

export function applyBossSet(match: BossMatch, outcome: DuelOutcome, t: Translator): {
  match: BossMatch
  finished: boolean
  finalOutcome?: DuelOutcome
} {
  const winner = outcome.won ? 'player' : 'enemy'
  const playerScore = outcome.won ? match.playerScore + 1 : match.playerScore
  const enemyScore = !outcome.won ? match.enemyScore + 1 : match.enemyScore
  const history = [
    ...match.history,
    {
      setNum: match.set,
      winner,
      reactionMs: outcome.reactionMs,
      headshot: outcome.headshot,
    } satisfies BossSetRecord,
  ]
  const next: BossMatch = {
    set: match.set,
    playerScore,
    enemyScore,
    history,
  }

  if (playerScore >= 2 || enemyScore >= 2) {
    const finalWon = playerScore >= 2
    return {
      match: next,
      finished: true,
      finalOutcome: {
        ...outcome,
        won: finalWon,
        detail: finalWon
          ? t('boss.win', { p: playerScore, e: enemyScore })
          : t('boss.lose', { p: playerScore, e: enemyScore }),
        bossScore: {
          playerWins: playerScore,
          enemyWins: enemyScore,
          totalSets: match.set,
          setHistory: history,
        },
      },
    }
  }

  return {
    match: { ...next, set: match.set + 1 },
    finished: false,
  }
}
