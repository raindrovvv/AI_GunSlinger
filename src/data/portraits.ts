import type { Opponent, PortraitId } from '../types'

/**
 * 초상화 배정
 *
 * 서버(api/generate.ts)가 상대를 만들면서 portrait 값을 같이 골라준다. 자기가
 * 방금 쓴 외모 문장을 보고 고르는 것이라 어긋날 이유가 거의 없다.
 *
 * 다만 서버가 값을 빠뜨리거나(구버전 응답, JSON 파손) 목록 밖의 값을 뱉는
 * 경우가 있으므로 3단으로 받는다:
 *
 *   1) 서버가 고른 값             — 거의 전부 여기서 끝난다
 *   2) 외모/별명 문장 키워드 추정  — 안대·금이빨 같은 특징, 없으면 성별·나이
 *   3) 이름 해시                   — 최후. 틀려도 매번 같은 얼굴은 보장된다
 *
 * 3)이 필요한 이유: 초상화가 비는 것보다 어긋나는 편이 낫고, 무엇보다 같은
 * 상대가 화면을 옮길 때마다 얼굴이 바뀌면 안 된다. 해시라 결정론적이다.
 */

const DIR = '/portraits'

/** 512px WebP. 원본 1536px PNG은 배포본에 넣지 않는다(장당 2MB). */
const EXT = 'webp'

/** 최종 라운드. 이 라운드 상대는 무조건 보스 초상화를 쓴다. */
const FINAL_ROUND = 9

/** 특징이 뚜렷한 9장. */
const NAMED: Record<string, string> = {
  young_cowboy: 'billy_carson',
  veiled_widow: 'rosa_beltran',
  gold_tooth_swindler: 'rex_morgan',
  masked_poncho: 'silva_carter',
  bespectacled_gunman: 'john_crawford',
  talisman_woman: 'marie_delacroix',
  fallen_sheriff: 'henry_ward',
  mechanical_arm: 'marcus_steel',
  // 최종보스 전용. 서버 선택 목록에는 없다 — 보스 얼굴이 3라운드 잡몹으로
  // 나오면 마지막 대면의 무게가 사라진다.
  final_boss: 'final_boss',
}

/** 특징 없는 예비 6종. 각 2장이라 같은 유형이 겹쳐도 얼굴이 갈린다. */
const WILDCARD_VARIANTS = 2
const WILDCARDS = new Set<PortraitId>([
  'young_male',
  'middle_male',
  'elder_male',
  'young_female',
  'middle_female',
  'masked_bandit',
])

export const PORTRAIT_IDS: PortraitId[] = [
  ...(Object.keys(NAMED) as PortraitId[]),
  ...WILDCARDS,
]

/** 문자열 → 32비트 부호 없는 해시. 같은 입력이면 항상 같은 값. */
function hash(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * 특징 키워드 표. 위에서부터 먼저 맞는 것을 쓰므로 순서가 곧 우선순위다.
 * 안대·기계팔처럼 그림에서 바로 보이는 것을 성별·나이보다 앞에 둔다.
 */
const KEYWORDS: [PortraitId, RegExp][] = [
  ['mechanical_arm', /기계 ?팔|의수|기계 ?눈|의안|강철 ?팔/],
  ['gold_tooth_swindler', /금이빨|금니|화려한 조끼|사기꾼/],
  ['bespectacled_gunman', /안경|수첩|장부|계산/],
  ['fallen_sheriff', /보안관|배지|별 ?모양 훈장/],
  ['talisman_woman', /부적|주술|마녀|망토/],
  // 판초만 보고 넘기면 후드 판초를 걸친 노인이 전부 이쪽으로 온다.
  // 실바 카터를 가르는 건 판초가 아니라 얼굴을 덮은 복면이다.
  ['masked_poncho', /판초(?=.*(복면|가면|스카프|반다나|가린))|(복면|가면|스카프|반다나|가린)(?=.*판초)/],
  ['masked_bandit', /복면|가면|마스크|반다나|얼굴[^,]{0,8}가린|얼굴[^,]{0,8}덮/],
  ['veiled_widow', /베일|과부|미망인/],
  ['middle_female', /보닛|숄/],
]

const FEMALE = /여자|여인|여성|그녀|과부|미망인|마녀|아가씨|소녀|부인|여전사|드레스|치마|머릿수건/
const ELDER = /노인|노파|늙은|백발|영감|주름진|고령/
const YOUNG = /젊은|청년|소년|소녀|앳된|어린/

/**
 * 서버 배정이 없을 때 외모 문장에서 추정한다.
 * 특징 → 나이·성별 순으로 좁히고, 아무것도 안 걸리면 null.
 */
function guessFromText(text: string): PortraitId | null {
  for (const [id, re] of KEYWORDS) {
    if (re.test(text)) return id
  }

  const female = FEMALE.test(text)
  if (ELDER.test(text)) {
    // 노인 여성 초상화가 없다. 나이보다 성별이 어긋날 때 더 눈에 띄므로
    // 중년 여성으로 보낸다.
    return female ? 'middle_female' : 'elder_male'
  }
  if (YOUNG.test(text)) return female ? 'young_female' : 'young_male'
  if (female) return 'middle_female'
  return null
}

/**
 * 배정된 초상화 id. 어떤 상대든 반드시 하나를 돌려준다.
 *
 * round를 넘기면 최종 라운드는 무조건 보스 얼굴로 간다. 캐릭터 자체는 매번
 * AI가 새로 만들되 마지막 대면의 얼굴만 고정하는 것이다 — 상대를 통째로
 * 하드코딩하면 수배서에 찍히는 AI GENERATED 라벨이 거짓이 된다.
 */
export function portraitIdFor(opponent: Opponent, round?: number): PortraitId {
  if (round === FINAL_ROUND) return 'final_boss'

  if (opponent.portrait && PORTRAIT_IDS.includes(opponent.portrait)) {
    return opponent.portrait
  }

  const guessed = guessFromText(`${opponent.appearance} ${opponent.alias} ${opponent.crime}`)
  if (guessed) return guessed

  // 최후 배정은 특징 없는 예비분에서만 고른다. 안대나 기계팔 같은 강한
  // 특징을 근거 없이 붙이면 외모 설명과 대놓고 어긋난다.
  const pool = [...WILDCARDS]
  return pool[hash(`${opponent.name}${opponent.alias}`) % pool.length]
}

/** 초상화 이미지 경로. 상대가 같으면 항상 같은 파일을 가리킨다. */
export function portraitSrc(opponent: Opponent, round?: number): string {
  const id = portraitIdFor(opponent, round)

  const named = NAMED[id]
  if (named) return `${DIR}/${named}.${EXT}`

  const variant = (hash(`${opponent.name}${opponent.alias}${id}`) % WILDCARD_VARIANTS) + 1
  return `${DIR}/wildcards/${id}_${variant}.${EXT}`
}
