import { DEFAULT_PLAYER_NAME, FAME_STREAK_THRESHOLD } from '../../shared/game'
import type { Locale } from '../../shared/locale'
import type { NewspaperArticle, Opponent } from '../types'

const HEADSHOT_QUOTES = [
  '"모자 날아가는 각도가 기가 막혔소. 바람개비인 줄 알았지." — 살롱 2층 손님',
  '"위스키 잔 닦다가 침 흘릴 뻔했수. 눈 깜빡할 새에 이마가 뚫렸소." — 살롱 바텐더',
  '"파리 한 마리도 저 친구 앞에서는 이마 조심해야겠어." — 대장장이 톰',
  '"나무 관 치수를 미리 재두길 잘했지. 아주 깔끔한 헤드샷이었소." — 마을 장의사 잭',
  '"총 뽑는 손이 아예 안 보였소. 서부의 악마가 강림한 줄 알았지." — 지나가던 역마차 승객',
  '"호외요, 호외! 잉크 마르기도 전에 다음 놈 이마가 뚫렸소!" — 신문팔이 소년 찰리',
]

const FAST_WIN_QUOTES = [
  '"맥주 거품이 꺼지기도 전에 결판이 났소. 이런 괴물은 처음 봐." — 살롱 단골손님',
  '"방아쇠 당기는 소리가 천둥보다 빨랐소. 심장이 덜컥 내려앉더군." — 순찰 돌던 보안관보',
  '"돈 걸 시간도 안 주더군. 배팅판 엎어졌소!" — 포커 치던 도박꾼',
  '"저 친구 탄피는 주워서 액자에 걸어둬야겠소." — 대장간 견습생',
  '"총알이 공기를 찢는 냄새가 아직도 코를 찌르오." — 은퇴한 노병',
  '"사신의 낫보다 저 친구 총구가 더 빠르더구려." — 늙은 광부',
]

const COMEBACK_QUOTES = [
  '"상대 총알이 저 친구 귀를 스쳤소! 심장마비 올 뻔했지 뭐요." — 지나가던 목장주',
  '"로열 스트레이트 플러시를 쥐고 있었는데, 총소리에 놀라 패를 엎었소! 물어내시오!" — 살롱 도박꾼',
  '"저승 문턱까지 갔다가 방아쇠 하나로 되돌아왔소." — 역마차 마부',
  '"관 뚜껑 못질 준비하고 있었는데, 손님이 바뀌었더군." — 마을 장의사 잭',
]

const PEACE_QUOTES = [
  '"술 마시며 싸움 구경하려다 맥만 빠졌소. 그래도 피 안 튀어 다행이오." — 살롱 바텐더',
  '"총 대신 말로 기를 죽이다니, 목사님보다 설교를 잘하더군." — 성당 신부님',
  '"오늘은 관이 안 팔리겠군. 그래도 평화로우니 됐소." — 마을 장의사 잭',
  '"서부에서 총알 한 발 안 쏘고 살아남은 놈은 저 녀석이 처음이오." — 늙은 사냥꾼',
  '"목숨값으로 술이나 한잔 사쇼." — 지나가던 카우보이',
]

const DEFEAT_QUOTES = [
  '"총 뽑는 법을 까먹은 줄 알았소. 저승길 조심해서 가시오." — 마을 장의사 잭',
  '"테이블 밑에 숨느라 술병 두 개 깼소. 저놈 현상금에서 까주쇼." — 살롱 바텐더',
  '"입만 살아서 덤비더니 사막 먼지만 들이마셨군." — 살롱 구경꾼',
  '"상대 눈빛 봤소? 이미 뽑기 전부터 져 있었소." — 지나가던 카우보이',
  '"관 치수는 넉넉하게 짜두겠소. 편히 쉬시오." — 관 짜는 목수',
]

const HEADSHOT_QUOTES_EN = [
  '"The hat left at a hell of an angle. Thought it was a pinwheel." — saloon upstairs',
  '"Nearly drooled on the whiskey glass. Blink, and the brow was open." — the barkeep',
  '"Even a fly ought to watch its forehead around that one." — Tom the smith',
  '"Good I measured the box early. Cleanest headshot I ever sold." — Jack the undertaker',
  '"Never saw the hand move. Thought the devil had come west." — a stage passenger',
  '"Extra! Extra! Next brow open before the ink dried!" — Charlie the paper boy',
]

const FAST_WIN_QUOTES_EN = [
  '"Over before the beer head died. Never saw a monster like that." — a regular',
  '"The trigger was louder than thunder. Heart dropped." — a deputy on walk',
  '"No time to lay a bet. The table went over!" — a poker man',
  '"I ought to frame that casing." — the smith\'s boy',
  '"The air still smells torn." — an old soldier',
  '"That muzzle beat the reaper\'s scythe." — an old miner',
]

const COMEBACK_QUOTES_EN = [
  '"Their slug kissed his ear! Near had a heart stop." — a rancher passing',
  '"I held a royal flush and dumped it at the shot! You owe me!" — saloon gambler',
  '"Went to the door of hell and came back on one trigger." — a stage driver',
  '"Had the lid nails ready. Wrong customer." — Jack the undertaker',
]

const PEACE_QUOTES_EN = [
  '"Came for a fight with a drink. Left with the drink. No blood, thank God." — the barkeep',
  '"Talked a gun down better than the preacher." — the padre',
  '"No boxes sold today. Quiet is fine by me." — Jack the undertaker',
  '"First man I saw walk out of the West without firing." — an old hunter',
  '"Buy a round for the life you kept." — a cowboy passing',
]

const DEFEAT_QUOTES_EN = [
  '"Forgot how to draw, I reckon. Mind the road down." — Jack the undertaker',
  '"Hid under the table and broke two bottles. Take it off that bounty." — the barkeep',
  '"All mouth, then ate desert dust." — a saloon watcher',
  '"Saw the eyes? Lost before the iron cleared." — a cowboy passing',
  '"I will cut the box generous. Rest easy." — the coffin man',
]

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function fallbackNewspaper(params: {
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
  locale?: Locale
}): NewspaperArticle {
  const {
    opponent,
    playerWon,
    peace,
    round,
    reactionMs,
    headshot,
    playerName,
    detail,
    streak = 0,
    fameTitle,
    locale = 'ko',
  } = params
  const en = locale === 'en'
  const fameTag =
    streak >= FAME_STREAK_THRESHOLD && fameTitle
      ? en
        ? `${fameTitle} on a ${streak}-win streak `
        : `${streak}연승의 '${fameTitle}' `
      : ''
  const hero = playerName?.trim() || (en ? 'Nameless Gunslinger' : DEFAULT_PLAYER_NAME)

  if (peace) {
    return {
      headline: en ? `A noon without a shot — ${opponent.alias} steps off` : `총성 없는 정오, ${opponent.alias} 물러서다`,
      body: en
        ? `The town waited on a bang. ${opponent.name} stopped the hand, and ${hero} never drew. They still talk about that quiet.`
        : `모두가 총성을 기다렸다. 그러나 ${opponent.name}은 손을 멈췄고, ${hero}도 총을 뽑지 않았다. 마을 사람들은 아직 그 침묵을 이야기한다.`,
      quote: pickRandom(en ? PEACE_QUOTES_EN : PEACE_QUOTES),
    }
  }

  if (playerWon) {
    if (headshot) {
      return {
        headline: en ? `Lightning headshot! ${fameTag}${hero} takes it` : `전광석화 헤드샷! ${fameTag}${hero} 완승`,
        body: en
          ? `Round ${round}. One shot broke the hush. ${fameTag}${hero} put a hole through ${opponent.name}'s hat${reactionMs ? ` in ${reactionMs}ms` : ''}.`
          : `제${round}차 결투. 단 한 발의 총성이 정적을 깼다. ${fameTag}${hero}는 ${reactionMs ? `${reactionMs}ms만에 ` : ''}${opponent.name}의 모자를 꿰뚫는 결정타를 날렸다.`,
        quote: pickRandom(en ? HEADSHOT_QUOTES_EN : HEADSHOT_QUOTES),
      }
    }
    if (detail && /역전|turned|Miracle|comeback/i.test(detail)) {
      return {
        headline: en ? `A miracle turn! ${opponent.alias} falls` : `기적의 역전승! ${opponent.alias} 쓰러지다`,
        body: en
          ? `Round ${round}. ${opponent.name}'s slug missed by a hair, and ${fameTag}${hero} put them down on the answer.`
          : `제${round}차 결투. ${opponent.name}의 총알이 아슬아슬하게 빗나간 찰나, ${fameTag}${hero}의 반격이 상대를 정확히 쓰러뜨렸다.`,
        quote: pickRandom(en ? COMEBACK_QUOTES_EN : COMEBACK_QUOTES),
      }
    }
    return {
      headline: en
        ? `${fameTag}${hero} drops ${opponent.alias} ($${opponent.bounty.toLocaleString()})`
        : `${fameTag}${hero}, ${opponent.alias} 격파 ($${opponent.bounty.toLocaleString()})`,
      body: en
        ? `Round ${round}. ${hero} read the tell ${opponent.name} could not hide (${opponent.tell.slice(0, 24)}…) and beat the beat. ${streak >= FAME_STREAK_THRESHOLD ? `The ${streak}-win rumor already rides the whole West.` : 'The rumor already hit the next town.'}`
        : `제${round}차 결투. ${hero}는 ${opponent.name}이 숨기지 못한 버릇(${opponent.tell.slice(0, 12)}…)을 읽고 반 박자 앞섰다. ${streak >= FAME_STREAK_THRESHOLD ? `${streak}연승의 소문은 이미 서부 전역으로 퍼졌다.` : '소문은 이미 다음 마을까지 갔다.'}`,
      quote: pickRandom(en ? FAST_WIN_QUOTES_EN : FAST_WIN_QUOTES),
    }
  }

  if (detail && /허공|air|shot air/i.test(detail)) {
    return {
      headline: en ? `Aim gone wild — ${hero} falls` : `조준 실패, ${hero} 쓰러지다`,
      body: en
        ? `Round ${round}. ${hero} shot the air, and ${opponent.name}'s cold iron ended it.`
        : `제${round}차 결투. ${hero}의 총알이 허공을 가르는 사이, ${opponent.name}의 냉혹한 사격이 결투를 끝냈다.`,
      quote: pickRandom(en ? DEFEAT_QUOTES_EN : DEFEAT_QUOTES),
    }
  }

  return {
    headline: en ? `${hero} loses to ${opponent.alias}` : `${hero}, ${opponent.alias}에게 지다`,
    body: en
      ? `Too fast, or too late. ${opponent.name}'s muzzle spoke first and the street kept only dust. The coffin man stayed busy.`
      : `너무 빨랐거나, 너무 늦었다. ${opponent.name}의 총구가 먼저 불을 뿜었고 거리에는 먼지만 남았다. 관 짜는 목수만 바빴다.`,
    quote: pickRandom(en ? DEFEAT_QUOTES_EN : DEFEAT_QUOTES),
  }
}
