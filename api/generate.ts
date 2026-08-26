import type { VercelRequest, VercelResponse } from '@vercel/node'
import OpenAI from 'openai'
import {
  ARCHETYPES,
  KOREAN_RULES,
  MODEL,
  NAME_RULES,
  OUTPUT_RULES,
  PORTRAIT_RULES,
  WORLD_RULES,
  clamp,
  clientIp,
  coercePortrait,
  difficultySpec,
  parseJsonLoose,
  rateLimited,
  sanitizeAlias,
  sanitizeLine,
  sanitizeWesternName,
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

  const { round = 1, previousNames = [] } = req.body ?? {}
  const spec = difficultySpec(Number(round) || 1)
  const archetype = ARCHETYPES[spec.round - 1] ?? ARCHETYPES[0]
  const avoidList = Array.isArray(previousNames) ? previousNames.slice(-6).join(', ') : ''

  const systemPrompt = `서부극 결투 상대 캐릭터를 생성해 JSON으로 반환하세요.

[상대 유형] ${archetype}
[기준 스탯] baseReactionMs ~${spec.reaction} (낮을수록 빠름), baseAccuracy ~${spec.accuracy}, bounty ~$${spec.bounty}

${NAME_RULES}
${avoidList ? `- 중복 방지: ${avoidList}` : ''}
- crime: 구체적 범죄 한 줄
- appearance: 외모 특징 한 줄
- tell: 뽑기 직전 관찰 가능한 신체 버릇 한 줄(손/눈/모자/장비 등)
- personality: 성격 및 대화 공략 약점 한 줄
- taunt: 결투 직전 도발 대사(40자 이내)
${PORTRAIT_RULES}

${KOREAN_RULES}
${WORLD_RULES}
${OUTPUT_RULES}

[출력 스키마]
{"name":"","alias":"","bounty":0,"crime":"","appearance":"","tell":"","personality":"","taunt":"","portrait":"","baseReactionMs":0,"baseAccuracy":0}`

  try {
    const completion = await getClient().chat.completions.create({
      model: MODEL,
      temperature: 1.05,
      // portrait 키가 늘면서 240에서는 잘릴 여지가 생겼다. 잘리면 JSON 전체가
      // 깨져 폴백으로 떨어지므로 여유를 둔다.
      max_tokens: 280,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `라운드 ${spec.round} 무법자 1명 생성` },
      ],
    })

    const parsed = parseJsonLoose(completion.choices[0]?.message?.content)

    const opponent = {
      id: `ai-${spec.round}-${Date.now()}`,
      name: sanitizeWesternName(parsed.name, spec.round),
      alias: sanitizeAlias(parsed.alias, '무명의 총잡이'),
      bounty: Math.round(clamp(Number(parsed.bounty) || spec.bounty, 500, 200000)),
      crime: sanitizeLine(parsed.crime, { max: 60, fallback: '알 수 없는 죄' }),
      appearance: sanitizeLine(parsed.appearance, {
        max: 60,
        fallback: '먼지투성이 코트와 낡은 모자',
      }),
      tell: sanitizeLine(parsed.tell, {
        max: 60,
        fallback: '뽑기 직전 침을 한 번 삼킨다',
      }),
      personality: sanitizeLine(parsed.personality, {
        max: 70,
        fallback: '호전적이며 도발에 쉽게 넘어간다',
      }),
      taunt: sanitizeLine(parsed.taunt, { max: 44, fallback: '덤벼라, 이름 없는 놈.' }),
      // 목록 밖이면 null로 넘긴다. 클라이언트가 appearance 키워드 → 이름 해시
      // 순으로 대신 배정하므로 초상화가 비는 일은 없다.
      portrait: coercePortrait(parsed.portrait),
      baseReactionMs: Math.round(
        clamp(Number(parsed.baseReactionMs) || spec.reaction, 220, 560),
      ),
      baseAccuracy: Number(
        clamp(Number(parsed.baseAccuracy) || spec.accuracy, 0.4, 0.98).toFixed(3),
      ),
    }

    return res.status(200).json({ opponent })
  } catch (err) {
    console.error('[generate]', err)
    return res.status(500).json({ error: 'generation failed' })
  }
}
