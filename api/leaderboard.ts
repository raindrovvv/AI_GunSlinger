import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Redis } from '@upstash/redis'
import { clientIp, rateLimited } from './_lib/rules.js'

/**
 * 서부 명부 — 리더보드 API
 *
 * 스키마 (Redis Sorted Set):
 *   lb:draw    score = 최속 드로우(ms, 낮을수록 상위)   member = playerId
 *   lb:bounty  score = 최고 현상금($, 높을수록 상위)     member = playerId
 *   lb:wins    score = 누적 승수(높을수록 상위)           member = playerId
 *   player:<id>  HASH { name }   — 표시용
 *
 * Sorted Set을 쓰는 이유: 순위 조회가 ZRANK 한 방(O(log N))으로 끝난다.
 * 직접 정렬하거나 COUNT 쿼리를 짤 필요가 없다.
 *
 * 갱신은 ZADD의 LT/GT 옵션으로 처리한다. 기존 기록보다 나을 때만 덮어쓰므로
 * "개인 최고 기록"이 저절로 유지되고, 같은 사람이 여러 줄로 쌓이지 않는다.
 *
 * ── 동점 처리 ──
 * 점수를 기록값 그대로 넣으면 307ms 동점자들의 순서를 Redis가 member 문자열
 * 사전순으로 정한다. 즉 순위가 플레이어 UUID 알파벳 순서라는 난수가 된다.
 *
 * 그래서 점수를 (기록값 × TIE_BASE + 시간항)으로 합성해 "먼저 달성한 사람이
 * 위"가 되게 한다. 스피드런 리더보드가 쓰는 방식이다.
 *
 * 정밀도: Redis score는 double이라 2^53(약 9.0e15)까지 정수를 정확히 담는다.
 * 최대 조합은 현상금 2e6 × 1e9 = 2e15로 안전한 범위 안이다. 그래서
 * MAX_BOUNTY를 1e7에서 2e6으로 낮췄다(게임상 완주 만점이 약 40만 달러라
 * 실사용에는 영향이 없다).
 */

const KEY_DRAW = 'lb:draw'
const KEY_BOUNTY = 'lb:bounty'
const KEY_WINS = 'lb:wins'

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
/** TIE_BASE와 곱해도 double 정밀도(9.0e15) 안에 들어오도록 잡은 상한 */
const MAX_BOUNTY = 2_000_000
const MAX_WINS = 100_000

const TIE_BASE = 1e9
/** 2025-01-01T00:00:00Z. 유닉스 초를 그대로 쓰면 시간항이 TIE_BASE를 넘는다 */
const TIE_EPOCH = 1_735_689_600

/** 동점을 가르는 시간항. 최근일수록 큰 값 */
function nowOffset(): number {
  return Math.max(0, Math.floor(Date.now() / 1000) - TIE_EPOCH)
}

/**
 * 기록값을 정렬용 합성 점수로. 같은 기록이면 먼저 달성한 쪽이 상위.
 *  낮을수록 상위(드로우): 시간항을 더해 늦게 달성할수록 점수가 커진다
 *  높을수록 상위(현상금): 시간항을 빼서 늦게 달성할수록 점수가 작아진다
 */
function encodeScore(value: number, desc: boolean): number {
  const t = nowOffset()
  return desc ? value * TIE_BASE + (TIE_BASE - t) : value * TIE_BASE + t
}

/**
 * 합성 점수에서 원래 기록값만 되꺼낸다.
 *
 * 동점 처리 도입 전에 쌓인 값은 합성되지 않은 raw 기록이라 그대로 나눠버리면
 * 0이 된다. TIE_BASE 미만이면 옛 형식으로 보고 그대로 돌려준다.
 */
function decodeScore(score: number): number {
  return score < TIE_BASE ? Math.round(score) : Math.floor(score / TIE_BASE)
}

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

interface TopEntry {
  rank: number
  id: string
  name: string
  value: number
}

const TOP_N = 10
/** 랭킹 모달에서 보여줄 전체 명단 길이 */
const TOP_FULL = 100

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
  return { rank: idx + 1, value: decodeScore(Number(score)) }
}

/** 상위 N명 — 드로우는 rev:false, 현상금은 rev:true */
async function readTopN(
  db: Redis,
  key: string,
  desc: boolean,
  limit = TOP_N,
): Promise<TopEntry[]> {
  const rows = await db.zrange(key, 0, limit - 1, { rev: desc, withScores: true })
  if (!rows?.length) return []

  const items: { id: string; value: number }[] = []
  if (typeof rows[0] === 'object' && rows[0] !== null && 'member' in rows[0]) {
    for (const row of rows) {
      const r = row as { member: string; score: number }
      items.push({ id: String(r.member), value: decodeScore(Number(r.score)) })
    }
  } else {
    for (let i = 0; i + 1 < rows.length; i += 2) {
      items.push({ id: String(rows[i]), value: decodeScore(Number(rows[i + 1])) })
    }
  }
  if (!items.length) return []

  // 개별 hget을 N번 왕복하면 명단이 길어질수록 그대로 지연이 된다.
  // 파이프라인으로 한 번에 묶는다.
  const pipe = db.pipeline()
  items.forEach((item) => pipe.hget(`player:${item.id}`, 'name'))
  const names = (await pipe.exec()) as (string | null)[]

  return items.map((item, i) => {
    const raw = names[i]
    const name =
      typeof raw === 'string' && raw.trim() ? raw.trim().slice(0, 24) : '이름 없는 총잡이'
    return { rank: i + 1, id: item.id, name, value: item.value }
  })
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

  const { action, id, name, drawMs, bounty, wins } = req.body ?? {}
  if (typeof id !== 'string' || id.length < 4 || id.length > 64) {
    return res.status(400).json({ error: 'bad id' })
  }

  try {
    // 랭킹 모달: 섹터별 상위 100명 + 내 순위
    if (action === 'top') {
      const [topDraw, topBounty, topWins, myDraw, myBounty, myWins] = await Promise.all([
        readTopN(db, KEY_DRAW, false, TOP_FULL),
        readTopN(db, KEY_BOUNTY, true, TOP_FULL),
        readTopN(db, KEY_WINS, true, TOP_FULL),
        readRank(db, KEY_DRAW, id, false),
        readRank(db, KEY_BOUNTY, id, true),
        readRank(db, KEY_WINS, id, true),
      ])
      return res.status(200).json({
        top: { draw: topDraw, bounty: topBounty, wins: topWins },
        mine: { draw: myDraw, bounty: myBounty, wins: myWins },
      })
    }

    const displayName =
      typeof name === 'string' && name.trim() ? name.trim().slice(0, 24) : '이름 없는 총잡이'
    await db.hset(`player:${id}`, { name: displayName })

    // 드로우: 더 빠를 때(LT)만 갱신
    const ms = Number(drawMs)
    if (Number.isFinite(ms) && ms >= MIN_DRAW_MS && ms <= MAX_DRAW_MS) {
      await db.zadd(KEY_DRAW, { lt: true }, { score: encodeScore(Math.round(ms), false), member: id })
    }

    // 현상금: 더 높을 때(GT)만 갱신
    const money = Number(bounty)
    if (Number.isFinite(money) && money > 0 && money <= MAX_BOUNTY) {
      await db.zadd(KEY_BOUNTY, { gt: true }, { score: encodeScore(Math.round(money), true), member: id })
    }

    const winCount = Number(wins)
    if (Number.isFinite(winCount) && winCount > 0 && winCount <= MAX_WINS) {
      await db.zadd(
        KEY_WINS,
        { gt: true },
        { score: encodeScore(Math.round(winCount), true), member: id },
      )
    }

    const [draw, money2, winsRank, topDraw, topBounty] = await Promise.all([
      readRank(db, KEY_DRAW, id, false),
      readRank(db, KEY_BOUNTY, id, true),
      readRank(db, KEY_WINS, id, true),
      readTopN(db, KEY_DRAW, false),
      readTopN(db, KEY_BOUNTY, true),
    ])

    return res.status(200).json({ draw, bounty: money2, wins: winsRank, topDraw, topBounty })
  } catch (err) {
    console.error('[leaderboard]', err)
    return res.status(500).json({ error: 'leaderboard failed' })
  }
}
