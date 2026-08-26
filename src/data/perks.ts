import type { Perk, PerkId } from '../types'
import { PERK_EFFECTS, percentFromScale } from './combat'

export const PERK_IDS: readonly PerkId[] = [
  'steady',
  'keen',
  'fast',
  'silver',
  'charm',
  'second_chance',
  'golden_spur',
  'poker_face',
]

export function isPerkId(v: unknown): v is PerkId {
  return typeof v === 'string' && (PERK_IDS as readonly string[]).includes(v)
}

export const PERKS: Perk[] = [
  {
    id: 'steady',
    name: '안정된 손',
    desc: '홀스터를 놓쳐도 한 번 더 용서받는다 (경고 +1)',
  },
  {
    id: 'keen',
    name: '매의 눈',
    desc: `명중 판정 범위가 ${percentFromScale(PERK_EFFECTS.keenHitScale)}% 넓어진다`,
  },
  {
    id: 'fast',
    name: '빠른 손',
    desc: `드로우 판정에서 ${PERK_EFFECTS.fastGraceMs}ms를 벌어준다`,
  },
  {
    id: 'silver',
    name: '은장식 총',
    desc: '헤드샷 판정이 넓어지고 보너스가 2배',
  },
  {
    id: 'charm',
    name: '낡은 부적',
    desc: `상대의 반응이 ${PERK_EFFECTS.charmDelayMs}ms 느려진다`,
  },
  {
    id: 'second_chance',
    name: '속사 리볼버',
    desc: '빗맞혔을 때 즉시 1회 재사격 기회를 얻는다',
  },
  {
    id: 'golden_spur',
    name: '황금 박차',
    desc: `결투 및 화해 보상 현상금이 ${percentFromScale(PERK_EFFECTS.goldenSpurMult)}% 증가한다`,
  },
  {
    id: 'poker_face',
    name: '포커페이스',
    desc: '대치에서 상대가 침착해지지 않아 불리함을 막아준다',
  },
]

export function perkById(id: PerkId): Perk {
  return PERKS.find((p) => p.id === id) ?? PERKS[0]
}

/** 아직 없는 장비 중에서 최대 count개를 무작위로 뽑는다 */
export function rollPerkChoices(owned: PerkId[], count = 3): PerkId[] {
  const pool = PERKS.filter((p) => !owned.includes(p.id)).map((p) => p.id)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, count)
}
