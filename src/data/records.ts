import type { CareerStats, PerkId, RunRecord } from '../types'

const STORAGE_KEY = 'ai-gunslinger.records.v1'
const MAX_RECENT = 12

export const EMPTY_CAREER: CareerStats = {
  runs: 0,
  victories: 0,
  defeats: 0,
  totalWins: 0,
  totalPeaces: 0,
  bestBounty: 0,
  bestReactionMs: null,
  bestStreak: 0,
  recent: [],
}

export interface RunSnapshot {
  victory: boolean
  wins: number
  peaces: number
  bounty: number
  bestReactionMs: number | null
  bestStreak: number
  roundsReached: number
  perks: PerkId[]
}

function isPerkId(v: unknown): v is PerkId {
  return (
    v === 'steady' ||
    v === 'keen' ||
    v === 'fast' ||
    v === 'silver' ||
    v === 'charm' ||
    v === 'second_chance' ||
    v === 'golden_spur' ||
    v === 'poker_face'
  )
}

function sanitizeRun(raw: unknown): RunRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const perks = Array.isArray(r.perks) ? r.perks.filter(isPerkId) : []
  const bestReactionMs =
    typeof r.bestReactionMs === 'number' && Number.isFinite(r.bestReactionMs)
      ? r.bestReactionMs
      : null
  return {
    id: typeof r.id === 'string' ? r.id : `run-${Date.now()}`,
    at: typeof r.at === 'number' ? r.at : Date.now(),
    victory: Boolean(r.victory),
    wins: Number(r.wins) || 0,
    peaces: Number(r.peaces) || 0,
    bounty: Number(r.bounty) || 0,
    bestReactionMs,
    bestStreak: Number(r.bestStreak) || 0,
    roundsReached: Number(r.roundsReached) || 1,
    perks,
  }
}

function sanitizeCareer(raw: unknown): CareerStats {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_CAREER }
  const c = raw as Record<string, unknown>
  const recent = Array.isArray(c.recent)
    ? c.recent.map(sanitizeRun).filter((x): x is RunRecord => x != null).slice(0, MAX_RECENT)
    : []
  const bestReactionMs =
    typeof c.bestReactionMs === 'number' && Number.isFinite(c.bestReactionMs)
      ? c.bestReactionMs
      : null
  return {
    runs: Number(c.runs) || 0,
    victories: Number(c.victories) || 0,
    defeats: Number(c.defeats) || 0,
    totalWins: Number(c.totalWins) || 0,
    totalPeaces: Number(c.totalPeaces) || 0,
    bestBounty: Number(c.bestBounty) || 0,
    bestReactionMs,
    bestStreak: Number(c.bestStreak) || 0,
    recent,
  }
}

export function loadCareer(): CareerStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...EMPTY_CAREER }
    return sanitizeCareer(JSON.parse(raw))
  } catch {
    return { ...EMPTY_CAREER }
  }
}

function saveCareer(career: CareerStats) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(career))
  } catch {
    // quota / private mode — ignore
  }
}

/** 런 종료 시 호출. 저장된 커리어와 방금 런을 반환한다. */
export function recordRun(snap: RunSnapshot): { career: CareerStats; run: RunRecord } {
  const prev = loadCareer()
  const run: RunRecord = {
    id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: Date.now(),
    victory: snap.victory,
    wins: snap.wins,
    peaces: snap.peaces,
    bounty: snap.bounty,
    bestReactionMs: snap.bestReactionMs,
    bestStreak: snap.bestStreak,
    roundsReached: snap.roundsReached,
    perks: [...snap.perks],
  }

  const bestReactionMs =
    snap.bestReactionMs == null
      ? prev.bestReactionMs
      : prev.bestReactionMs == null
        ? snap.bestReactionMs
        : Math.min(prev.bestReactionMs, snap.bestReactionMs)

  const career: CareerStats = {
    runs: prev.runs + 1,
    victories: prev.victories + (snap.victory ? 1 : 0),
    defeats: prev.defeats + (snap.victory ? 0 : 1),
    totalWins: prev.totalWins + snap.wins,
    totalPeaces: prev.totalPeaces + snap.peaces,
    bestBounty: Math.max(prev.bestBounty, snap.bounty),
    bestReactionMs,
    bestStreak: Math.max(prev.bestStreak, snap.bestStreak),
    recent: [run, ...prev.recent].slice(0, MAX_RECENT),
  }

  saveCareer(career)
  return { career, run }
}

export function formatReaction(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '—'
  return `${Math.round(ms)}ms`
}

export function formatRunDate(at: number): string {
  try {
    return new Date(at).toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}
