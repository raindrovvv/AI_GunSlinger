/**
 * 서부 명부 — 실제 리더보드 클라이언트
 *
 * 예전 버전에는 ms를 순위로 바꾸는 가짜 곡선과 자체 등급(유령손/번개손 …)이
 * 있었는데, 실제 DB를 붙이면서 전부 걷어냈다. 순위는 서버가 실제 기록들
 * 사이에서 계산한다. 등급 표시는 기존 S/A/B/C(드로우)와 fame.ts(연승 명성)가
 * 이미 담당하고 있으므로 여기서 새로 만들지 않는다.
 */

/** 이 브라우저를 식별하는 값. 같은 사람이 여러 줄로 쌓이지 않게 한다. */
const PLAYER_ID_KEY = 'ai-gunslinger.player-id'

export function getPlayerId(): string {
  try {
    const saved = localStorage.getItem(PLAYER_ID_KEY)
    if (saved) return saved
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `p-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    localStorage.setItem(PLAYER_ID_KEY, id)
    return id
  } catch {
    // 프라이빗 모드 등 localStorage를 못 쓰는 환경
    return `anon-${Math.random().toString(36).slice(2, 10)}`
  }
}

export interface BoardEntry {
  /** 1부터 시작하는 순위 */
  rank: number
  /** 기록값 (드로우는 ms, 현상금은 달러) */
  value: number
}

export interface TopBoardEntry extends BoardEntry {
  id: string
  name: string
}

export interface RankResult {
  draw: BoardEntry | null
  bounty: BoardEntry | null
  topDraw?: TopBoardEntry[]
  topBounty?: TopBoardEntry[]
}

export interface SubmitPayload {
  name: string
  /** 이번 런에서 가장 빨랐던 드로우 (없으면 생략) */
  drawMs?: number | null
  /** 이번 런 누적 현상금 */
  bounty?: number | null
}

const TIMEOUT_MS = 6000

async function postJson<T>(url: string, body: unknown): Promise<T | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 런 종료 시 기록을 올리고, 갱신된 내 순위를 돌려받는다.
 * 서버가 죽어 있거나 느리면 null — 호출부는 순위 영역을 숨기면 된다.
 */
export async function submitRun(payload: SubmitPayload): Promise<RankResult | null> {
  return postJson<RankResult>('/api/leaderboard', {
    action: 'submit',
    id: getPlayerId(),
    ...payload,
  })
}

export function formatRank(rank: number): string {
  return `${rank.toLocaleString()}위`
}
