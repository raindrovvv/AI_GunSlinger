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

  const { opponent, playerWon, peace, mood, round } = req.body ?? {}
  if (!opponent?.name) {
    return res.status(400).json({ error: 'missing opponent' })
  }

  const outcome = peace
    ? '총 한 발 쏘지 않고 결투가 무산됨'
    : playerWon
      ? '이름 없는 총잡이가 승리'
      : '이름 없는 총잡이가 패배'

  const systemPrompt = `당신은 1880년대 서부 신문 '더스트 타운 가제트'의 기자입니다. 결투 기사를 씁니다.

[기사 규칙]
- headline: 24자 이내. 결과가 한눈에 보이게. 본문을 그대로 반복하지 않는다.
- body: 2~3문장, 160자 이내. 현장 묘사와 결정적 순간을 담는다.
- quote: 목격자나 당사자의 한마디. 끝에 ' — 말한 사람'을 붙인다.
- 과장된 옛 신문 문체 + 건조한 유머 한 방울.
- 결과를 뒤집거나 없는 사실을 만들지 않는다.

${KOREAN_RULES}

${WORLD_RULES}

${OUTPUT_RULES}

[출력 스키마]
{"headline":"","body":"","quote":""}`

  try {
    const completion = await getClient().chat.completions.create({
      model: MODEL,
      temperature: 1.0,
      max_tokens: 320,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `제${round}차 결투
상대: ${opponent.name} (${opponent.alias}), 현상금 ${opponent.bounty}달러
죄목: ${opponent.crime}
결투 직전 상대의 심리: ${mood}
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
