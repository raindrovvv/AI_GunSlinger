import type { VercelRequest, VercelResponse } from '@vercel/node'
import OpenAI from 'openai'
import { DEFAULT_PLAYER_NAME, FAME_STREAK_THRESHOLD, isFinalRound } from '../shared/game.js'
import {
  KOREAN_RULES,
  MODEL,
  OUTPUT_RULES,
  WORLD_RULES,
  clientIp,
  parseJsonLoose,
  rateLimited,
  sanitizeLine,
} from './_lib/rules.js'

function getClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
}

export const config = { maxDuration: 20 }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'API key missing' })
  }
  if (rateLimited(clientIp(req.headers as Record<string, unknown>))) {
    return res.status(429).json({ error: 'too many requests' })
  }

  const {
    opponent,
    playerWon,
    peace,
    mood,
    round,
    reactionMs,
    headshot,
    detail,
    playerName,
    streak = 0,
    fameTitle,
    bossScore,
  } = req.body ?? {}
  if (!opponent?.name) {
    return res.status(400).json({ error: 'missing opponent' })
  }

  const fameTag = streak >= FAME_STREAK_THRESHOLD && fameTitle ? `${streak}연승의 '${fameTitle}' ` : ''
  const hero = typeof playerName === 'string' && playerName.trim() ? playerName.trim() : DEFAULT_PLAYER_NAME

  const bossContext =
    isFinalRound(Number(round) || 0) || bossScore
      ? `[최종 보스 3판 2선승제 사투]\n- 최종 스코어: ${hero} ${bossScore?.playerWins ?? (playerWon ? 2 : 1)}승 vs ${opponent.alias} ${bossScore?.enemyWins ?? (playerWon ? 1 : 2)}승\n- 3차전까지 이어진 서부 역사상 가장 치열했던 결투`
      : null

  const outcomeGuide = peace
    ? `[결투 결과: 평화적 해결]\n- 총성 없이 대화로 결투가 무산됨.\n- 헤드라인: 평화적 타결 또는 ${opponent.alias}의 퇴장.`
    : playerWon
      ? `[결투 결과: 플레이어(${hero}) 승리 / 무법자(${opponent.name}) 격파]\n- 승자: ${fameTag}${hero} (현상금 $${opponent.bounty.toLocaleString()} 획득)\n- 패자: 무법자 ${opponent.name} (피격되어 쓰러짐)\n- 플레이어 공식 연승: 이번 승리를 포함하여 정확히 [${streak}연승] (⚠️ 절대 ${streak + 1}연승으로 숫자를 올리지 말 것)\n- 헤드라인: ${hero}의 승리 및 ${opponent.name} 격파 보도.`
      : `[결투 결과: 무법자(${opponent.name}) 승리 / 플레이어(${hero}) 패배]\n- 승자: 무법자 ${opponent.name} (승리하여 생존)\n- 패자: 도전자 ${hero} (피격되어 사망/패배)\n- ⚠️ 절대 주의: 승자는 ${opponent.name}이고 패자는 ${hero}입니다. ${opponent.name}이 패배했다고 쓰면 절대 안 됩니다!\n- 헤드라인: ${opponent.name}의 승리 또는 ${hero}의 쓰러짐 보도.`

  const duelDetails = [
    bossContext,
    streak >= 2 && fameTitle ? `도전자 공식 기록: 이번 결투를 포함해 정확히 [${streak}연승] 달성 ('${fameTitle}')` : null,
    `결투 직전 상대 심리: ${mood ?? '알 수 없음'}`,
    opponent.tell ? `상대의 드로우 버릇: ${opponent.tell}` : null,
    reactionMs ? `플레이어 반응 속도: 정확히 ${reactionMs}ms` : null,
    headshot
      ? `명중 부위: 이마/머리 (헤드샷 완승)`
      : `명중 부위: 몸통 (헤드샷 아님, 헤드샷/이마 관통 단어 절대 사용 금지)`,
    detail ? `결투 정황: ${detail}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  const systemPrompt = `당신은 1880년대 서부 신문 '더스트 타운 가제트'의 기자입니다.
주어진 결투 결과를 바탕으로 신문 기사를 작성하세요.

[기사 작성 규칙]
- 승자와 패자의 역할을 절대 혼동하거나 뒤바꾸지 마십시오.
  · 플레이어 승리 시: ${hero}가 ${opponent.name}을 쓰러뜨린 무용담을 씁니다.
  · 플레이어 패배 시: ${opponent.name}의 총에 ${hero}가 쓰러졌음을 보도합니다. ${opponent.name}이 졌다고 왜곡 금지!
- 수치 및 사실 엄수:
  · 연승: 이번 승리 포함 정확히 [${streak}연승] (임의로 ${streak + 1}연승 등 계산 금지)
  · 라운드: 제${round}차 결투
  · 반응속도: ${reactionMs ? `${reactionMs}ms` : '빠른 속도'}
  · 헤드샷 여부: ${headshot ? '헤드샷' : '몸통 사격 (헤드샷 단어 사용 금지)'}
- headline: 24자 이내(승패가 명확한 서부식 기사 헤드라인)
- body: 2~3문장(140자 이내, 승패의 결정적 순간 묘사)
- quote: 서부 특유의 위트와 블랙 유머가 담긴 개성 넘치는 목격자 한마디 ('"증언 내용" — 화자' 형식)
  · '목격자' 대신 장의사, 살롱 바텐더, 도박꾼, 대장장이, 신문팔이 소년, 목장주 등 개성 있는 마을 인물의 생생한 말투를 쓰세요.
  · 예시: '"위스키 잔 닦다가 침 흘릴 뻔했수. 0.2초 만에 이마가 뚫렸소." — 살롱 바텐더'
  · 예시: '"나무 관 치수를 미리 재두길 잘했지. 저 친구 총솜씨는 매출 보증수표요." — 마을 장의사 잭'
  · 예시: '"로열 스트레이트 플러시를 쥐고 있었는데 놀라서 패를 엎었소! 물어내시오!" — 살롱 도박꾼'

${KOREAN_RULES}
${WORLD_RULES}
${OUTPUT_RULES}

[출력 스키마]
{"headline":"","body":"","quote":""}`

  try {
    const completion = await getClient().chat.completions.create({
      model: MODEL,
      temperature: 0.8,
      max_tokens: 180,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `[제${round}차 결투 사건 보고서]
도전자(플레이어): ${hero}
상대 무법자: ${opponent.name} (${opponent.alias}), 현상금 $${opponent.bounty}
무법자 죄목: ${opponent.crime}
${duelDetails}

${outcomeGuide}`,
        },
      ],
    })

    const parsed = parseJsonLoose(completion.choices[0]?.message?.content)

    let finalHeadline = sanitizeLine(parsed.headline, {
      max: 30,
      fallback: peace
        ? '총성 없이 끝난 정오'
        : playerWon
          ? `${hero}, ${opponent.alias} 격파`
          : `${hero}, ${opponent.alias}에게 쓰러지다`,
    })

    let finalBody = sanitizeLine(parsed.body, {
      max: 200,
      fallback: playerWon
        ? `${hero}의 총알이 ${opponent.name}을 쓰러뜨렸다.`
        : `${opponent.name}의 총알이 거리를 갈랐고, ${hero}는 쓰러졌다.`,
    })

    // 1. AI의 연승 계산 오차(+1 연승 환각) 보정
    if (streak > 0) {
      const wrongStreakRe = new RegExp(`${streak + 1}연승`, 'g')
      finalHeadline = finalHeadline.replace(wrongStreakRe, `${streak}연승`)
      finalBody = finalBody.replace(wrongStreakRe, `${streak}연승`)
    }

    // 2. 헤드샷이 아닌데 헤드샷 단어를 생성한 경우 보정
    if (!headshot) {
      finalHeadline = finalHeadline.replace(/헤드샷[!?,]?/g, '선제 사격')
      finalBody = finalBody.replace(/헤드샷[!?,]?/g, '선제 사격')
    }

    return res.status(200).json({
      headline: finalHeadline,
      body: finalBody,
      quote: sanitizeLine(parsed.quote, {
        max: 70,
        fallback: playerWon
          ? '"방아쇠는 거짓말을 못 한다." — 목격자'
          : `"${hero}? 내 상대가 못 되었지." — ${opponent.alias}`,
      }),
    })
  } catch (err) {
    console.error('[newspaper]', err)
    return res.status(500).json({ error: 'newspaper failed' })
  }
}
