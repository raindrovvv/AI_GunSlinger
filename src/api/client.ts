import type { Locale } from '../../shared/locale'
import type { DuelMods, MoodShift, NewspaperArticle, Opponent } from '../types'
import { FALLBACK_OPPONENTS } from '../data/fallback'
import { displayOpponent } from '../i18n/content'
import { fallbackChat } from '../offline/chat'
import { fallbackNewspaper } from '../offline/newspaper'

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
  locale: Locale = 'ko',
): Promise<{ opponent: Opponent; usedAi: boolean }> {
  const data = await postJson<{ opponent: Opponent }>('/api/generate', {
    round,
    previousNames,
    locale,
  })
  if (data?.opponent?.name) {
    return { opponent: data.opponent, usedAi: true }
  }
  const idx = Math.min(round - 1, FALLBACK_OPPONENTS.length - 1)
  return {
    opponent: displayOpponent(
      { ...FALLBACK_OPPONENTS[idx], id: `fb-${round}-${Date.now()}` },
      locale,
    ),
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
  locale?: Locale
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
  bossScore?: {
    playerWins: number
    enemyWins: number
    totalSets: number
  }
  locale?: Locale
}): Promise<{ article: NewspaperArticle; usedAi: boolean }> {
  const data = await postJson<NewspaperArticle>('/api/newspaper', params)
  if (data?.headline) {
    return { article: data, usedAi: true }
  }
  return { article: fallbackNewspaper(params), usedAi: false }
}
