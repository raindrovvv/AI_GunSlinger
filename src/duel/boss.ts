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

export function nextSetBanner(nextSet: number, won: boolean) {
  if (nextSet === 2) {
    return won
      ? {
          title: 'PHASE 2 · 분노한 사신의 각성',
          subtitle: '보스가 붉은 기운을 뿜으며 자세를 고쳐잡습니다! (반응속도 & 페인트 증가)',
        }
      : {
          title: 'PHASE 2 · 반격의 기회',
          subtitle: '아직 끝나지 않았다. 마음을 다잡고 방아쇠를 쥐어라!',
        }
  }
  return {
    title: 'FINAL PHASE · 최후의 일격 (1:1 동점)',
    subtitle: '마지막 한 발로 모든 운명이 결정된다!',
  }
}

export function applyBossSet(match: BossMatch, outcome: DuelOutcome): {
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
          ? `3판 2선승 대결 승리! (${playerScore}:${enemyScore}) 전설의 보스를 쓰러뜨렸다!`
          : `3판 2선승 대결 패배... (${playerScore}:${enemyScore}) 마지막 사투에서 무릎 꿇다.`,
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
