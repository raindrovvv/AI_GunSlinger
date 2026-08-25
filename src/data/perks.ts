import type { Perk, PerkId } from '../types'

export const PERKS: Perk[] = [
  {
    id: 'steady',
    name: '안정된 손',
    desc: '홀스터를 놓쳐도 한 번 더 용서받는다 (경고 +1)',
  },
  {
    id: 'keen',
    name: '매의 눈',
    desc: '명중 판정 범위가 30% 넓어진다',
  },
  {
    id: 'fast',
    name: '빠른 손',
    desc: '드로우 판정에서 60ms를 벌어준다',
  },
  {
    id: 'silver',
    name: '은장식 총',
    desc: '헤드샷 판정이 넓어지고 보너스가 2배',
  },
  {
    id: 'charm',
    name: '낡은 부적',
    desc: '상대의 반응이 35ms 느려진다',
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
