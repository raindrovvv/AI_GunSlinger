import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Redis } from '@upstash/redis'
import { clientIp, rateLimited } from './_lib/rules.js'

/**
 * 서부 명부 — 리더보드 API
 *
 * 스키마 (Redis Sorted Set):
 *   lb:draw    score = 최속 드로우(ms, 낮을수록 상위)   member = playerId
 *   lb:bounty  score = 최고 현상금($, 높을수록 상위)     member = playerId
 *   player:<id>  HASH { name }   — 표시용
 *
 * Sorted Set을 쓰는 이유: 순위 조회가 ZRANK 한 방(O(log N))으로 끝난다.
 * 직접 정렬하거나 COUNT 쿼리를 짤 필요가 없다.
 *
 * 갱신은 ZADD의 LT/GT 옵션으로 처리한다. 기존 기록보다 나을 때만 덮어쓰므로
 * "개인 최고 기록"이 저절로 유지되고, 같은 사람이 여러 줄로 쌓이지 않는다.
 */

const KEY_DRAW = 'lb:draw'
const KEY_BOUNTY = 'lb:bounty'

/**
 * 사람이 낼 수 없는 값을 걷어내는 하한선.
 *
 * 시각 자극을 인지해 손가락이 움직이기까지의 생리학적 바닥이 약 120ms다
 * (망막→시각피질 50~70ms + 운동 명령 30~50ms). 육상에서 출발 반응이
 * 100ms 미만이면 부정 출발로 보는 것과 같은 기준이며, 그쪽은 더 빠른
 * 청각 경로다.
 *
 * 게다가 이 게임은 홀스터(화면 하단 중앙)에서 상대(x=0.82)까지 커서를
 * 옮겨야 해서 이동 시간이 최소 100ms 더 붙는다. 실제 바닥은 250ms 근처다.
 * 그래서 120ms는 진짜 플레이어를 걸러낼 위험이 없는, 넉넉히 보수적인 선이다.
 * 이 값을 막는 목적은 부정행위 근절이 아니라, 1ms 같은 값이 1위에 박제돼
 * 그 아래 모든 진짜 기록이 밀려나는 걸 방지하는 것이다.
 */
const MIN_DRAW_MS = 120
const MAX_DRAW_MS = 10000
const MAX_BOUNTY = 10_000_000

let redis: Redis | null = null
function getRedis(): Redis | null {
  if (redis) return redis
  try {
    redis = Redis.fromEnv()
    return redis
  } catch {
    // 환경변수가 없으면 리더보드만 비활성. 게임은 그대로 돌아간다.
    return null
  }
}

export const config = { maxDuration: 10 }

interface Entry {
  rank: number
  value: number
}

/** ZRANK는 0-based. 드로우는 오름차순(빠른 게 앞), 현상금은 내림차순. */
async function readRank(
  db: Redis,
  key: string,
  id: string,
  desc: boolean,
): Promise<Entry | null> {
  const score = await db.zscore(key, id)
  if (score == null) return null
  const idx = desc ? await db.zrevrank(key, id) : await db.zrank(key, id)
  if (idx == null) return null
  return { rank: idx + 1, value: Number(score) }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (rateLimited(clientIp(req.headers as Record<string, unknown>))) {
    return res.status(429).json({ error: 'too many requests' })
  }

  const db = getRedis()
  if (!db) return res.status(503).json({ error: 'leaderboard disabled' })

  const { id, name, drawMs, bounty } = req.body ?? {}
  if (typeof id !== 'string' || id.length < 4 || id.length > 64) {
    return res.status(400).json({ error: 'bad id' })
  }

  try {
    const displayName =
      typeof name === 'string' && name.trim() ? name.trim().slice(0, 24) : '이름 없는 총잡이'
    await db.hset(`player:${id}`, { name: displayName })

    // 드로우: 더 빠를 때(LT)만 갱신
    const ms = Number(drawMs)
    if (Number.isFinite(ms) && ms >= MIN_DRAW_MS && ms <= MAX_DRAW_MS) {
      await db.zadd(KEY_DRAW, { lt: true }, { score: Math.round(ms), member: id })
    }

    // 현상금: 더 높을 때(GT)만 갱신
    const money = Number(bounty)
    if (Number.isFinite(money) && money > 0 && money <= MAX_BOUNTY) {
      await db.zadd(KEY_BOUNTY, { gt: true }, { score: Math.round(money), member: id })
    }

    const [draw, money2] = await Promise.all([
      readRank(db, KEY_DRAW, id, false),
      readRank(db, KEY_BOUNTY, id, true),
    ])

    return res.status(200).json({ draw, bounty: money2 })
  } catch (err) {
    console.error('[leaderboard]', err)
    return res.status(500).json({ error: 'leaderboard failed' })
  }
}
