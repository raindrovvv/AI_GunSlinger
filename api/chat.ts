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
  dialogueFallback,
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

  const {
    opponent,
    history = [],
    playerMessage,
    turn = 1,
    round = 1,
    streak = 0,
    fameTitle,
  } = req.body ?? {}
  if (!opponent?.name || typeof playerMessage !== 'string') {
    return res.status(400).json({ error: 'missing fields' })
  }

  const fameContext =
    streak >= 2
      ? `- 상대 총잡이: ${fameTitle ?? '실력자'} (${streak}연승 중인 명사수. 연승이 높을수록 위압감을 느끼거나 긴장함)`
      : ''

  const systemPrompt = `당신은 1880년대 서부 무법자 '${opponent.name}'(${opponent.alias})입니다. 결투 직전 대치 중입니다.

[캐릭터]
- 죄목: ${opponent.crime ?? '알 수 없음'}
- 성격/약점: ${opponent.personality}
- 드로우 직전 버릇: ${opponent.tell} (상대가 정확히 짚으면 동요/부정)
- 도발 원문(재사용 금지): ${opponent.taunt}
${fameContext}

${PERSONA_LOCK}
${DIALOGUE_RULES}
${KOREAN_RULES}
${WORLD_RULES}

[심리/수치 판정]
상대 대사의 영향에 따라 mood를 고르고 수치를 결정하세요.
${moodGuideText()}
- 턴: ${turn}/3 ${turn >= 3 ? '(마지막 턴)' : ''}
- peaceEnding: 3턴째에 상대 설득이 성격에 깊이 닿았을 때만 true

${OUTPUT_RULES}

[출력 스키마]
{"reply":"대사","mood":"calm|angered|intimidated|scared|suspicious","reactionDeltaMs":숫자,"accuracyDelta":숫자,"peaceEnding":true|false}`

  try {
    const completion = await getClient().chat.completions.create({
      model: MODEL,
      temperature: 0.9,
      max_tokens: 130,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        ...(Array.isArray(history) ? history : [])
          .slice(-4)
          .map((h: { role: string; text: string }) => ({
            role: h.role === 'player' ? ('user' as const) : ('assistant' as const),
            content: String(h.text).slice(0, 120),
          })),
        { role: 'user', content: playerMessage.slice(0, 120) },
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

    const rawReply = sanitizeLine(parsed.reply, {
      max: 70,
      fallback: '',
    })
    const taunt = String(opponent.taunt ?? '').trim()
    const reply =
      rawReply && rawReply !== taunt
        ? rawReply
        : dialogueFallback(mood)

    return res.status(200).json({
      reply,
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
