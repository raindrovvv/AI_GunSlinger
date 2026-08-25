import type { VercelRequest, VercelResponse } from '@vercel/node'
import OpenAI from 'openai'
import {
  DIALOGUE_RULES,
  KOREAN_RULES,
  MODEL,
  OUTPUT_RULES,
  PERSONA_LOCK,
  WORLD_RULES,
  clientIp,
  coerceDeltas,
  coerceMood,
  moodGuideText,
  parseJsonLoose,
  peaceAllowed,
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

  const { opponent, history = [], playerMessage, turn = 1, round = 1 } = req.body ?? {}
  if (!opponent?.name || typeof playerMessage !== 'string') {
    return res.status(400).json({ error: 'missing fields' })
  }

  const systemPrompt = `당신은 1880년대 서부의 무법자 '${opponent.name}'(별명 ${opponent.alias})입니다.
결투 직전, 먼지 나는 거리에서 상대와 마주 서 있습니다.

[캐릭터]
- 성격과 약점: ${opponent.personality}
- 겉모습: ${opponent.appearance}
- 총을 뽑기 직전 나오는 버릇: ${opponent.tell}
  → 이 버릇을 먼저 입에 올리지 않는다. 상대가 정확히 짚으면 동요한다.
- 평소 도발: ${opponent.taunt}

${PERSONA_LOCK}

${DIALOGUE_RULES}

${KOREAN_RULES}

${WORLD_RULES}

[심리 판정]
상대의 말이 당신에게 어떤 영향을 줬는지 판단해 mood를 하나 고르고, 아래 범위에서 수치를 정한다.
${moodGuideText()}

지금은 ${turn}번째 말이고 최대 3번이다. ${turn >= 3 ? '이번이 마지막 말이다.' : ''}
peaceEnding은 마지막 턴에, 상대의 설득이 당신 성격에 정말로 닿았을 때만 true. 단순히 '평화'라는 단어만으로는 안 된다.

${OUTPUT_RULES}

[출력 스키마]
{"reply":"대사","mood":"calm|angered|intimidated|scared|suspicious","reactionDeltaMs":숫자,"accuracyDelta":숫자,"peaceEnding":true|false}`

  try {
    const completion = await getClient().chat.completions.create({
      model: MODEL,
      temperature: 0.9,
      max_tokens: 220,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        ...(Array.isArray(history) ? history : [])
          .slice(-6)
          .map((h: { role: string; text: string }) => ({
            role: h.role === 'player' ? ('user' as const) : ('assistant' as const),
            content: String(h.text).slice(0, 200),
          })),
        { role: 'user', content: playerMessage.slice(0, 200) },
      ],
    })

    const parsed = parseJsonLoose(completion.choices[0]?.message?.content)
    const mood = coerceMood(parsed.mood)
    const { reactionDeltaMs, accuracyDelta } = coerceDeltas(
      mood,
      parsed.reactionDeltaMs,
      parsed.accuracyDelta,
    )
    const peaceEnding =
      !!parsed.peaceEnding && peaceAllowed(Number(round) || 1, Number(turn) || 1, mood)

    return res.status(200).json({
      reply: sanitizeLine(parsed.reply, {
        max: 70,
        fallback: '말은 충분하다. 손을 준비해라.',
      }),
      mood,
      reactionDeltaMs,
      accuracyDelta,
      peaceEnding,
    })
  } catch (err) {
    console.error('[chat]', err)
    return res.status(500).json({ error: 'chat failed' })
  }
}
