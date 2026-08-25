import type { DuelMods, MoodShift, NewspaperArticle, Opponent } from '../types'
import { FALLBACK_OPPONENTS } from '../data/fallback'

async function postJson<T>(url: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export async function checkAiHealth(): Promise<boolean> {
  try {
    const res = await fetch('/api/health')
    if (!res.ok) return false
    const data = (await res.json()) as { ok?: boolean }
    return !!data.ok
  } catch {
    return false
  }
}

export async function generateOpponent(
  round: number,
  previousNames: string[],
): Promise<{ opponent: Opponent; usedAi: boolean }> {
  const data = await postJson<{ opponent: Opponent }>('/api/generate', {
    round,
    previousNames,
  })
  if (data?.opponent?.name) {
    return { opponent: data.opponent, usedAi: true }
  }
  const idx = Math.min(round - 1, FALLBACK_OPPONENTS.length - 1)
  return {
    opponent: { ...FALLBACK_OPPONENTS[idx], id: `fb-${round}-${Date.now()}` },
    usedAi: false,
  }
}

export async function standoffChat(params: {
  opponent: Opponent
  history: { role: string; text: string }[]
  playerMessage: string
  turn: number
  round: number
  streak?: number
  fameTitle?: string
}): Promise<{
  reply: string
  mood: MoodShift
  mods: DuelMods
  usedAi: boolean
}> {
  const data = await postJson<{
    reply: string
    mood: MoodShift
    reactionDeltaMs: number
    accuracyDelta: number
    peaceEnding: boolean
  }>('/api/chat', params)

  if (data?.reply) {
    return {
      reply: data.reply,
      mood: data.mood ?? 'calm',
      mods: {
        mood: data.mood ?? 'calm',
        reactionDeltaMs: data.reactionDeltaMs ?? 0,
        accuracyDelta: data.accuracyDelta ?? 0,
        peaceEnding: !!data.peaceEnding,
      },
      usedAi: true,
    }
  }

  return fallbackChat(params)
}

/* --------------------------- 오프라인 대화 엔진 --------------------------- */

type Intent = 'peace' | 'ask' | 'read' | 'threat' | 'taunt' | 'respect' | 'idle'

/** mood별 심리 변화량. 서버 프롬프트와 같은 표를 쓴다. */
const MOOD_EFFECT: Record<MoodShift, { reaction: number; accuracy: number }> = {
  calm: { reaction: -12, accuracy: 0.05 },
  angered: { reaction: -35, accuracy: -0.14 },
  intimidated: { reaction: 45, accuracy: -0.05 },
  scared: { reaction: 85, accuracy: -0.12 },
  suspicious: { reaction: 32, accuracy: -0.07 },
}

// 순서가 우선순위. 넓은 단어(손, 눈, 물러)는 오분류를 만들어 쓰지 않는다.
const PATTERNS: { intent: Intent; re: RegExp }[] = [
  {
    intent: 'peace',
    re: /평화|화해|술이나|한잔|한 잔|그만하|그만두|멈추|내려놓|싸우지|싸울 필요|살려|목숨|친구|가족|고향/,
  },
  { intent: 'ask', re: /\?|？|뭐야|뭐지|뭔데|무슨 말|무엇|어떻게|왜 그|누구냐|설명해/ },
  {
    intent: 'read',
    re: /버릇|습관|들켰|들통|들킨|보였|읽었|읽혔|간파|약점|빈틈|숨기지|티가|다 보|떨리|떨고/,
  },
  { intent: 'threat', re: /죽여|죽는|죽을|무덤|묻어|묻힐|끝장|후회|관에|관 속|지옥|장례|시체/ },
  {
    intent: 'taunt',
    re: /느려|느리|약해|약하|겁쟁|겁먹|무섭|도망|허세|우습|시시|촌뜨기|하찮|별로|풋내기|굼벵/,
  },
  { intent: 'respect', re: /인정|존경|대단|강하|유명|소문|명성|실력|영광|최고|고수/ },
]

function detectIntent(msg: string): Intent {
  for (const p of PATTERNS) {
    if (p.re.test(msg)) return p.intent
  }
  return 'idle'
}

const LINES: Record<Intent, string[]> = {
  taunt: [
    '뭐라고 했나. 다시 말해봐, 혀부터 날려주지.',
    '입은 살았군. 그 입 곧 다물게 해주마.',
    '하! 그 말, 네 무덤에 새겨주겠다.',
  ],
  respect: [
    '…말은 바르군. 그래도 총알은 사람 안 가린다.',
    '예의 있는 놈은 기억해둔다. 오늘은 아니겠지만.',
    '흥. 알아보는 눈은 있구나.',
  ],
  threat: [
    '…허풍이면 좋겠군. 손이 왜 이렇게 무거워지지.',
    '그런 눈빛, 전에도 봤다. 그놈은 결국 날 못 쐈어.',
    '겁주려는 거냐. 통했다고는 안 하겠다.',
  ],
  read: [
    '…뭘 봤다는 거냐. 헛소리 말아라.',
    '그걸… 어떻게 알았지.',
    '날 계속 지켜봤군. 소름 끼치는 놈이야.',
  ],
  peace: [
    '총을 내려놓자고? 이 마을에서 그런 말 하는 놈은 처음이다.',
    '…술이라. 오랜만에 듣는 소리군.',
    '웃기는 소리. 그런데 왜 손이 멈추지.',
  ],
  ask: [
    '지금 그런 걸 물을 때인가.',
    '질문은 무덤에서 해라.',
    '…말이 많군. 그게 네 마지막 말이 되겠어.',
  ],
  idle: [
    '말은 충분하다. 총으로 하자.',
    '서부는 말솜씨로 정해지지 않는다.',
    '더 할 말 없으면, 손을 준비해라.',
  ],
}

function pick(lines: string[], seed: number) {
  return lines[Math.abs(seed) % lines.length]
}

/** 한글 종성 유무. 조사를 자연스럽게 붙이기 위해 필요하다. */
function hasFinalConsonant(word: string) {
  const ch = word.trim().slice(-1).charCodeAt(0)
  if (Number.isNaN(ch) || ch < 0xac00 || ch > 0xd7a3) return false
  return (ch - 0xac00) % 28 !== 0
}

function fallbackChat(params: {
  opponent: Opponent
  playerMessage: string
  turn: number
  round: number
}): {
  reply: string
  mood: MoodShift
  mods: DuelMods
  usedAi: boolean
} {
  const { opponent, playerMessage, turn, round } = params
  const msg = playerMessage.trim()
  const intent = detectIntent(msg)
  const seed = msg.length + turn

  let mood: MoodShift
  switch (intent) {
    case 'taunt':
      mood = 'angered'
      break
    case 'respect':
      mood = 'intimidated'
      break
    case 'threat':
      mood = 'scared'
      break
    case 'read':
      mood = 'suspicious'
      break
    case 'peace':
      mood = turn >= 2 ? 'scared' : 'intimidated'
      break
    default:
      mood = 'calm'
  }

  const sincere = /진심|제발|부탁|목숨|가족|약속|맹세|아이|고향/.test(msg)
  const peaceEnding = intent === 'peace' && turn >= 3 && (round <= 6 || sincere)

  let reply = peaceEnding
    ? '…좋다. 오늘은 피를 아끼자. 꺼져라, 살아서.'
    : pick(LINES[intent], seed)

  // 첫 도발에는 이름을 각인시키며 받아친다
  if (intent === 'taunt' && turn === 1) {
    const name = opponent.name
    reply = `${reply} 내 이름은 ${name}${hasFinalConsonant(name) ? '이' : ''}다. 잊지 마라.`
  }

  const effect = MOOD_EFFECT[mood]

  return {
    reply,
    mood,
    mods: {
      mood,
      reactionDeltaMs: effect.reaction,
      accuracyDelta: effect.accuracy,
      peaceEnding,
    },
    usedAi: false,
  }
}

/* ------------------------------- 신문 기사 ------------------------------- */

export async function generateNewspaper(params: {
  opponent: Opponent
  playerWon: boolean
  peace: boolean
  mood: MoodShift
  round: number
  reactionMs?: number | null
  headshot?: boolean
  detail?: string
  playerName?: string
  streak?: number
  fameTitle?: string
}): Promise<{ article: NewspaperArticle; usedAi: boolean }> {
  const data = await postJson<NewspaperArticle>('/api/newspaper', params)
  if (data?.headline) {
    return { article: data, usedAi: true }
  }
  return { article: fallbackNewspaper(params), usedAi: false }
}

function fallbackNewspaper(params: {
  opponent: Opponent
  playerWon: boolean
  peace: boolean
  round: number
  reactionMs?: number | null
  headshot?: boolean
  detail?: string
  playerName?: string
  streak?: number
  fameTitle?: string
}): NewspaperArticle {
  const { opponent, playerWon, peace, round, reactionMs, headshot, playerName, detail, streak = 0, fameTitle } = params
  const fameTag = streak >= 2 && fameTitle ? `${streak}연승의 '${fameTitle}' ` : ''
  const hero = playerName?.trim() || '이름 없는 총잡이'

  if (peace) {
    return {
      headline: `총성 없는 정오, ${opponent.alias} 물러서다`,
      body: `모두가 총성을 기다렸다. 그러나 ${opponent.name}은 손을 멈췄고, ${hero}도 총을 뽑지 않았다. 마을 사람들은 아직 그 침묵을 이야기한다.`,
      quote: `"오늘은 피가 아깝다." — ${opponent.alias}`,
    }
  }

  if (playerWon) {
    if (headshot) {
      return {
        headline: `전광석화 헤드샷! ${fameTag}${hero} 완승`,
        body: `제${round}차 결투. 단 한 발의 총성이 정적을 깼다. ${fameTag}${hero}는 ${reactionMs ? `${reactionMs}ms만에 ` : ''}${opponent.name}의 모자를 꿰뚫는 결정타를 날렸다.`,
        quote: '"눈 깜빡할 틈도 없었소." — 목격자',
      }
    }
    if (detail?.includes('역전')) {
      return {
        headline: `기적의 역전승! ${opponent.alias} 쓰러지다`,
        body: `제${round}차 결투. ${opponent.name}의 총알이 아슬아슬하게 빗나간 찰나, ${fameTag}${hero}의 반격이 상대를 정확히 쓰러뜨렸다.`,
        quote: '"간발의 차이로 목숨을 건졌소." — 목격자',
      }
    }
    return {
      headline: `${fameTag}${hero}, ${opponent.alias} 격파 ($${opponent.bounty.toLocaleString()})`,
      body: `제${round}차 결투. ${hero}는 ${opponent.name}이 숨기지 못한 버릇(${opponent.tell.slice(0, 12)}…)을 읽고 반 박자 앞섰다. ${streak >= 2 ? `${streak}연승의 소문은 이미 서부 전역으로 퍼졌다.` : '소문은 이미 다음 마을까지 갔다.'}`,
      quote: '"방아쇠는 거짓말을 못 한다." — 목격자',
    }
  }

  if (detail?.includes('허공')) {
    return {
      headline: `조준 실패, ${hero} 쓰러지다`,
      body: `제${round}차 결투. ${hero}의 총알이 허공을 가르는 사이, ${opponent.name}의 냉혹한 사격이 결투를 끝냈다.`,
      quote: '"총을 쏠 땐 상대를 봐야지." — ' + opponent.alias,
    }
  }

  return {
    headline: `${hero}, ${opponent.alias}에게 지다`,
    body: `너무 빨랐거나, 너무 늦었다. ${opponent.name}의 총구가 먼저 불을 뿜었고 거리에는 먼지만 남았다. 관 짜는 목수만 바빴다.`,
    quote: opponent.taunt,
  }
}
