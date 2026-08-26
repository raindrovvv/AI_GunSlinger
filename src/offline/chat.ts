import type { Locale } from '../../shared/locale'
import { defaultMoodDeltas, peaceAllowed, type Mood } from '../../shared/mood'
import type { DuelMods, Opponent } from '../types'

type Intent = 'peace' | 'ask' | 'read' | 'threat' | 'taunt' | 'respect' | 'idle'

const PATTERNS: { intent: Intent; re: RegExp }[] = [
  {
    intent: 'peace',
    re: /평화|화해|술이나|한잔|한 잔|그만하|그만두|멈추|내려놓|싸우지|싸울 필요|살려|목숨|친구|가족|고향|peace|truce|drink|whiskey|holster|stand down|spare|family|home/i,
  },
  { intent: 'ask', re: /\?|？|뭐야|뭐지|뭔데|무슨 말|무엇|어떻게|왜 그|누구냐|설명해|\bwhat\b|\bwhy\b|\bwho\b|\bhow\b/i },
  {
    intent: 'read',
    re: /버릇|습관|들켰|들통|들킨|보였|읽었|읽혔|간파|약점|빈틈|숨기지|티가|다 보|떨리|떨고|tell|habit|twitch|weakness|crack|I see|shaking/i,
  },
  { intent: 'threat', re: /죽여|죽는|죽을|무덤|묻어|묻힐|끝장|후회|관에|관 속|지옥|장례|시체|kill|dead|grave|coffin|hell|bury|corpse/i },
  {
    intent: 'taunt',
    re: /느려|느리|약해|약하|겁쟁|겁먹|무섭|도망|허세|우습|시시|촌뜨기|하찮|별로|풋내기|굼벵|slow|weak|coward|scared|bluff|green|joke/i,
  },
  { intent: 'respect', re: /인정|존경|대단|강하|유명|소문|명성|실력|영광|최고|고수|respect|honor|skill|legend|glory|finest/i },
]

function detectIntent(msg: string): Intent {
  for (const p of PATTERNS) {
    if (p.re.test(msg)) return p.intent
  }
  return 'idle'
}

const LINES_EN: Record<Intent, string[]> = {
  taunt: [
    'Say that again. I will take the tongue first.',
    'The mouth lives. I will shut it.',
    'Ha! I will carve that on your stone.',
  ],
  respect: [
    '…Fair words. Lead still does not pick favorites.',
    'I remember a polite man. Not today.',
    'Hnh. You can see, at least.',
  ],
  threat: [
    '…Hope that is wind. Why is the hand so heavy.',
    'I have seen that look. He never fired.',
    'Trying to scare me. I will not say it worked.',
  ],
  read: [
    '…What did you see. Keep that talk.',
    'How did you know that.',
    'You have been watching. That crawls.',
  ],
  peace: [
    'Holster it? First man in this town to say that.',
    '…A drink. Been a while since I heard that.',
    'A joke. Then why did the hand stop.',
  ],
  ask: [
    'This is no time for that.',
    'Ask it in the grave.',
    '…Too many words. That may be your last.',
  ],
  idle: [
    'Talk is enough. Iron next.',
    'The West is not won with a pretty line.',
    'If you are done talking, set the hand.',
  ],
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

function hasFinalConsonant(word: string) {
  const ch = word.trim().slice(-1).charCodeAt(0)
  if (Number.isNaN(ch) || ch < 0xac00 || ch > 0xd7a3) return false
  return (ch - 0xac00) % 28 !== 0
}

export function fallbackChat(params: {
  opponent: Opponent
  playerMessage: string
  turn: number
  round: number
  locale?: Locale
}): {
  reply: string
  mood: Mood
  mods: DuelMods
  usedAi: boolean
} {
  const { opponent, playerMessage, turn, round, locale = 'ko' } = params
  const msg = playerMessage.trim()
  const intent = detectIntent(msg)
  const seed = msg.length + turn
  const sincere = /진심|제발|부탁|목숨|가족|약속|맹세|아이|고향|please|swear|child|family|home|mercy/.test(msg)

  let mood: Mood
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
      // 후반 라운드는 진심이 닿아야 공포까지 간다. 서버 peaceAllowed와 같은 축.
      mood = round > 6 && !sincere ? 'intimidated' : turn >= 2 ? 'scared' : 'intimidated'
      break
    default:
      mood = 'calm'
  }

  const peaceEnding = intent === 'peace' && peaceAllowed(round, turn, mood)
  const bank = locale === 'en' ? LINES_EN : LINES
  let reply = peaceEnding
    ? locale === 'en'
      ? '…Fine. Spare the blood today. Get out living.'
      : '…좋다. 오늘은 피를 아끼자. 꺼져라, 살아서.'
    : pick(bank[intent], seed)

  if (intent === 'taunt' && turn === 1) {
    const name = opponent.name
    reply =
      locale === 'en'
        ? `${reply} Name is ${name}. Do not forget it.`
        : `${reply} 내 이름은 ${name}${hasFinalConsonant(name) ? '이' : ''}다. 잊지 마라.`
  }

  const effect = defaultMoodDeltas(mood)

  return {
    reply,
    mood,
    mods: {
      mood,
      reactionDeltaMs: effect.reactionDeltaMs,
      accuracyDelta: effect.accuracyDelta,
      peaceEnding,
    },
    usedAi: false,
  }
}
