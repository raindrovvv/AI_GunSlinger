import type { ConsumableId, ConsumableItem } from '../types'

export const CONSUMABLE_ITEMS: ConsumableItem[] = [
  {
    id: 'whiskey',
    name: '독한 뱀독 위스키',
    desc: '다음 대치에서 상대의 위협에 동요하지 않고, 내 발언의 심리 압박력이 50% 증폭됩니다.',
    price: 400,
    icon: '🥃',
    tag: '대치',
  },
  {
    id: 'smoke',
    name: '서부 연막탄',
    desc: '다음 결투 시 자욱한 연막을 피워 상대의 기본 사격 명중률을 20% 감소시킵니다.',
    price: 600,
    icon: '💨',
    tag: '결투',
  },
  {
    id: 'powder',
    name: '고급 정밀 화약',
    desc: '다음 결투 시 총알의 집탄율이 극대화되어 헤드샷 판정 범위가 40% 넓어집니다.',
    price: 800,
    icon: '🎯',
    tag: '결투',
  },
  {
    id: 'bible',
    name: '방탄 포켓 성경',
    desc: '다음 결투에서 상대 총알에 치명상을 입더라도 가슴의 성경이 1회 막아내어 생존합니다.',
    price: 1200,
    icon: '🛡️',
    tag: '결투',
  },
  {
    id: 'intel',
    name: '정보상 비밀 수첩',
    desc: '다음 무법자의 숨겨진 치명적 약점과 과거 사건 힌트를 대치 시작 전 미리 파악합니다.',
    price: 350,
    icon: '📜',
    tag: '정보',
  },
]

export const PERK_BUY_PRICE = 1000
export const PERK_REROLL_PRICE = 200

export function getConsumableById(id: ConsumableId): ConsumableItem {
  const item = CONSUMABLE_ITEMS.find((c) => c.id === id)
  if (!item) {
    throw new Error(`Unknown consumable: ${id}`)
  }
  return item
}
