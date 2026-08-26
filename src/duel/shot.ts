import type { Translator } from '../i18n/types'
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
  t: Translator
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
        detail: enemyHits ? input.t('shot.missHit') : input.t('shot.miss'),
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
        detail: head ? input.t('shot.head', { ms: raw }) : input.t('shot.first', { ms: raw }),
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
        detail: input.t('shot.bible', { ms: raw }),
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
        ? input.t('shot.late', { enemy: enemyMs })
        : input.t('shot.comeback', { ms: raw }),
      reactionMs: raw,
      grade: enemyHits ? '-' : gradeOf(input.rawMs),
      headshot: head && !enemyHits,
      foul: false,
    },
  }
}
