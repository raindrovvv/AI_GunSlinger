import type { DuelMods, DuelOutcome, Opponent, PerkId } from '../types'

/** 실제 판정에 쓰는 수치. UI 설명은 이 값을 따른다. */
export const PERK_EFFECTS = {
  keenHitScale: 1.35,
  silverHeadScale: 1.25,
  fastGraceMs: 65,
  charmDelayMs: 40,
  goldenSpurMult: 1.3,
  silverHeadBountyMult: 2,
  baseHeadBountyMult: 1.5,
  peaceBountyMult: 0.6,
  streakCap: 5,
  streakStep: 0.1,
} as const

export const CONSUMABLE_EFFECTS = {
  powderHeadScale: 1.45,
  smokeAccuracy: 0.2,
  whiskeyPressure: 1.5,
} as const

export function percentFromScale(scale: number) {
  return Math.round((scale - 1) * 100)
}

export function rewardFor(
  opponent: Opponent,
  outcome: DuelOutcome | null,
  isPeace: boolean,
  streak: number,
  perks: PerkId[],
) {
  const spurMult = perks.includes('golden_spur') ? PERK_EFFECTS.goldenSpurMult : 1
  if (isPeace) return Math.round(opponent.bounty * PERK_EFFECTS.peaceBountyMult * spurMult)
  const headMult = outcome?.headshot
    ? perks.includes('silver')
      ? PERK_EFFECTS.silverHeadBountyMult
      : PERK_EFFECTS.baseHeadBountyMult
    : 1
  const streakMult = 1 + Math.min(streak, PERK_EFFECTS.streakCap) * PERK_EFFECTS.streakStep
  return Math.round(opponent.bounty * headMult * streakMult * spurMult)
}

export interface DuelTuning {
  warnings: number
  hitScale: number
  headScale: number
  fastGrace: number
  enemyReaction: number
  accuracy: number
  hitBonusPercent: number
}

export function computeDuelTuning(input: {
  round: number
  opponentName: string
  baseReactionMs: number
  baseAccuracy: number
  mods: DuelMods
  perks: readonly PerkId[]
  powder?: boolean
  smoke?: boolean
}): DuelTuning {
  const { round, opponentName, baseReactionMs, baseAccuracy, mods, perks } = input
  const roundScale = round <= 3 ? 1.28 : round <= 6 ? 1.15 : 1.05
  const moodScale =
    mods.mood === 'scared' || mods.mood === 'intimidated' || mods.mood === 'suspicious'
      ? 1.18
      : mods.mood === 'angered'
        ? 1.1
        : mods.mood === 'calm'
          ? 0.95
          : 1.0

  const envJitter = (((opponentName.length * 13 + round * 37) % 11) - 5) * 0.01
  const perkHitScale = perks.includes('keen') ? PERK_EFFECTS.keenHitScale : 1
  const perkHeadScale =
    (perks.includes('silver') ? PERK_EFFECTS.silverHeadScale : 1) *
    (input.powder ? CONSUMABLE_EFFECTS.powderHeadScale : 1)
  const totalHitScale = roundScale * moodScale * (1 + envJitter) * perkHitScale
  const jitter = ((opponentName.length * 17 + round * 23) % 25) - 12
  const smokeDebuff = input.smoke ? CONSUMABLE_EFFECTS.smokeAccuracy : 0

  return {
    warnings: 1 + (perks.includes('steady') ? 1 : 0),
    hitScale: totalHitScale,
    headScale: perkHeadScale,
    fastGrace: perks.includes('fast') ? PERK_EFFECTS.fastGraceMs : 0,
    enemyReaction: Math.max(
      190,
      baseReactionMs +
        mods.reactionDeltaMs +
        jitter +
        (perks.includes('charm') ? PERK_EFFECTS.charmDelayMs : 0),
    ),
    accuracy: Math.min(0.99, Math.max(0.12, baseAccuracy + mods.accuracyDelta - smokeDebuff)),
    hitBonusPercent: Math.round((totalHitScale - 1) * 100),
  }
}
