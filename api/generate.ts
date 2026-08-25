import type { VercelRequest, VercelResponse } from '@vercel/node'
import OpenAI from 'openai'
import {
  ARCHETYPES,
  KOREAN_RULES,
  MODEL,
  OUTPUT_RULES,
  WORLD_RULES,
  clamp,
  clientIp,
  difficultySpec,
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

  const { round = 1, previousNames = [] } = req.body ?? {}
  const spec = difficultySpec(Number(round) || 1)
  const archetype = ARCHETYPES[spec.round - 1] ?? ARCHETYPES[0]

  const systemPrompt = `당신은 서부극 캐릭터 설계자입니다. 결투 상대 한 명을 만들어 JSON으로 반환하세요.

[이번 상대의 결]
${archetype}

[난이도 ${spec.round}/9 기준값]
- baseReactionMs: ${spec.reaction} 근처 (±25). 낮을수록 빠르다.
- baseAccuracy: ${spec.accuracy} 근처 (±0.04)
- bounty: ${spec.bounty} 근처

[필드 작성 규칙]
- name: 한국식 이름. 이미 쓴 이름과 겹치면 안 된다 → ${JSON.stringify(previousNames).slice(0, 300)}
- alias: 서부극다운 별명. 8자 이내.
- crime: 죄목 한 줄. 구체적인 사건으로.
- appearance: 결투장에서 눈에 보이는 겉모습 한 줄.
- tell: 총을 뽑기 직전 반드시 나오는 '몸의 습관' 한 줄.
  → 반드시 눈으로 관찰 가능한 동작이어야 한다 (손, 눈, 발, 입, 장비).
  → 심리 묘사나 추상적 표현("살기를 뿜는다") 금지.
- personality: 성격 + 어떤 말에 흔들리는지 한 줄. 대화 공략 단서가 되어야 한다.
- taunt: 결투 전 던지는 도발 한마디. 40자 이내, 실제 입말.

${KOREAN_RULES}

${WORLD_RULES}

${OUTPUT_RULES}

[출력 스키마]
{"name":"","alias":"","bounty":0,"crime":"","appearance":"","tell":"","personality":"","taunt":"","baseReactionMs":0,"baseAccuracy":0}`

  try {
    const completion = await getClient().chat.completions.create({
      model: MODEL,
      temperature: 1.05,
      max_tokens: 400,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `라운드 ${spec.round} 상대를 만들어라.` },
      ],
    })

    const parsed = parseJsonLoose(completion.choices[0]?.message?.content)

    const opponent = {
      id: `ai-${spec.round}-${Date.now()}`,
      name: sanitizeLine(parsed.name, { max: 16, fallback: '이름 없는 자' }),
      alias: sanitizeLine(parsed.alias, { max: 14, fallback: '무명의 총잡이' }),
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
