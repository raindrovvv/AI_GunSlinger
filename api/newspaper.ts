import type { VercelRequest, VercelResponse } from '@vercel/node'
import OpenAI from 'openai'
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
  } = req.body ?? {}
  if (!opponent?.name) {
    return res.status(400).json({ error: 'missing opponent' })
  }

  const fameTag = streak >= 2 && fameTitle ? `${streak}연승의 '${fameTitle}' ` : ''
  const hero = typeof playerName === 'string' && playerName.trim() ? playerName.trim() : '이름 없는 총잡이'

  const outcome = peace
    ? '총 한 발 쏘지 않고 결투가 무산됨 (평화적 해결)'
    : playerWon
      ? headshot
        ? `${fameTag}${hero}가 전광석화 헤드샷으로 완승`
        : `${fameTag}${hero}가 선제 사격으로 승리`
      : `${hero}가 패배`

  const duelDetails = [
    streak >= 2 && fameTitle ? `플레이어 명성: ${streak}연승 '${fameTitle}'` : null,
    `결투 직전 상대 심리: ${mood ?? '알 수 없음'}`,
    opponent.tell ? `상대의 드로우 버릇: ${opponent.tell}` : null,
    reactionMs ? `반응 시간: ${reactionMs}ms` : null,
    headshot ? `명중 부위: 이마/머리 (헤드샷)` : null,
    detail ? `결투 정황: ${detail}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  const systemPrompt = `당신은 1880년대 서부 신문 기자입니다. 결투 기사를 작성하세요.

[기사 규칙]
- headline: 24자 이내(결과 요약)
- body: 2~3문장(140자 이내, 헤드샷/버릇/속도 등 결정적 순간 묘사)
- quote: 목격자/당사자 한마디(' — 화자' 형식)

${KOREAN_RULES}
${WORLD_RULES}
${OUTPUT_RULES}

[출력 스키마]
{"headline":"","body":"","quote":""}`

  try {
    const completion = await getClient().chat.completions.create({
      model: MODEL,
      temperature: 1.0,
      max_tokens: 160,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `제${round}차 결투
상대: ${opponent.name} (${opponent.alias}), $${opponent.bounty}
죄목: ${opponent.crime}
${duelDetails}
결과: ${outcome}`,
        },
      ],
    })

    const parsed = parseJsonLoose(completion.choices[0]?.message?.content)

    return res.status(200).json({
      headline: sanitizeLine(parsed.headline, {
        max: 30,
        fallback: peace ? '총성 없이 끝난 정오' : '먼지 위에 남은 한 발',
      }),
      body: sanitizeLine(parsed.body, {
        max: 200,
        fallback: '거리에는 먼지만 남았다. 목격자들은 서로 다른 이야기를 한다.',
      }),
      quote: sanitizeLine(parsed.quote, {
        max: 70,
        fallback: '"방아쇠는 거짓말을 못 한다." — 목격자',
      }),
    })
  } catch (err) {
    console.error('[newspaper]', err)
    return res.status(500).json({ error: 'newspaper failed' })
  }
}
