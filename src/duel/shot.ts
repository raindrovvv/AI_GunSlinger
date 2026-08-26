import type { DuelOutcome } from '../types'
import { gradeOf } from './grade'
import type { HitZone } from './hit'

export type ShotDecision =
  | { type: 'second_chance' }
  | { type: 'resolve'; outcome: DuelOutcome; bibleUsed?: boolean }

export function enemyHitChance(effectiveMs: number, enemyMs: number, accuracy: number) {
  const closeCall = effectiveMs - enemyMs <= 50
  return closeCall ? accuracy * 0.55 : accuracy
}

export function decidePlayerShot(input: {
  hit: HitZone
  rawMs: number
  effectiveMs: number
  enemyMs: number
  now: number
  enemyShotAt: number
  accuracy: number
  roll: number
  hasSecondChance: boolean
  secondChanceUsed: boolean
  hasBible: boolean
  bibleUsed: boolean
}): ShotDecision {
  const raw = Math.round(input.rawMs)
  const enemyMs = Math.round(input.enemyMs)

  if (input.hit === 'miss') {
    if (input.hasSecondChance && !input.secondChanceUsed && input.now < input.enemyShotAt) {
      return { type: 'second_chance' }
    }
    const enemyHits = input.now >= input.enemyShotAt && input.roll < input.accuracy
    return {
      type: 'resolve',
      outcome: {
        won: false,
        detail: enemyHits ? '허공을 쐈다. 상대의 총알에 피격.' : '허공을 쐈다! 조준이 빗나갔다.',
        reactionMs: raw,
        grade: '-',
        headshot: false,
        foul: false,
      },
    }
  }

  const head = input.hit === 'head'
  if (input.effectiveMs < input.enemyMs) {
    return {
      type: 'resolve',
      outcome: {
        won: true,
        detail: head ? `헤드샷! ${raw}ms` : `선제 사격! ${raw}ms`,
        reactionMs: raw,
        grade: gradeOf(input.rawMs),
        headshot: head,
        foul: false,
      },
    }
  }

  const enemyHits = input.roll < enemyHitChance(input.effectiveMs, input.enemyMs, input.accuracy)
  if (enemyHits && input.hasBible && !input.bibleUsed) {
    return {
      type: 'resolve',
      bibleUsed: true,
      outcome: {
        won: true,
        detail: `가슴의 포켓 성경이 총알을 튕겨냈다! 기적의 역전 명중! (${raw}ms)`,
        reactionMs: raw,
        grade: gradeOf(input.rawMs),
        headshot: head,
        foul: false,
      },
    }
  }

  return {
    type: 'resolve',
    outcome: {
      won: !enemyHits,
      detail: enemyHits
        ? `한발 늦었다! 상대의 총알에 피격. (상대 ${enemyMs}ms)`
        : `상대의 총알이 빗나갔다! 역전 명중 성공! (${raw}ms)`,
      reactionMs: raw,
      grade: enemyHits ? '-' : gradeOf(input.rawMs),
      headshot: head && !enemyHits,
      foul: false,
    },
  }
}
