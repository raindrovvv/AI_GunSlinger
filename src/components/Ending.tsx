import { useEffect, useState } from 'react'
import { sfx } from '../audio/sfx'
import { getPlayerId, submitRun, type RankResult, type TopBoardEntry } from '../data/ranking'
import { localizedFame, localizedPerk } from '../i18n/content'
import { useT } from '../i18n/LocaleContext'
import type { CareerStats, PerkId, RunRecord } from '../types'
import { PerkIcon } from './PerkIcon'
import { RankingModal } from './RankingModal'
import { RecordBoard } from './RecordBoard'

interface Props {
  wins: number
  peaces: number
  bounty: number
  perks: PerkId[]
  victory: boolean
  career: CareerStats
  lastRun: RunRecord
  playerName?: string
  onRestart: () => void
  onReplayCutscene?: () => void
}

function TopList({
  title,
  entries,
  formatValue,
  myId,
}: {
  title: string
  entries: TopBoardEntry[]
  formatValue: (value: number) => string
  myId: string
}) {
  if (!entries.length) return null

  return (
    <div className="registry-toplist">
      <span className="registry-toplist-title">{title}</span>
      <ol className="registry-toplist-rows">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className={`registry-row${entry.id === myId ? ' is-me' : ''}`}
          >
            <span className="registry-row-rank">{entry.rank}</span>
            <span className="registry-row-name">{entry.name}</span>
            <span className="registry-row-val">{formatValue(entry.value)}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

export function Ending({
  wins,
  peaces,
  bounty,
  perks,
  victory,
  career,
  lastRun,
  playerName,
  onRestart,
  onReplayCutscene,
}: Props) {
  const t = useT()
  const hero = playerName || t('player.default')
  const runFame = localizedFame(lastRun.bestStreak, t)

  // 서부 명부: 런이 끝나면 커리어 최고 기록을 올리고 순위를 받아온다.
  // 서버가 없거나 느리면 board가 null로 남고, 순위 영역은 그냥 나타나지 않는다.
  const [board, setBoard] = useState<RankResult | null>(null)
  const [showRanking, setShowRanking] = useState(false)
  useEffect(() => {
    let alive = true
    submitRun({
      name: hero,
      drawMs: career.bestReactionMs,
      bounty: career.bestBounty,
      wins: career.totalWins,
    }).then((r) => {
      if (alive && r) setBoard(r)
    })
    return () => {
      alive = false
    }
  }, [hero, career.bestReactionMs, career.bestBounty, career.totalWins])

  const [displayedBounty, setDisplayedBounty] = useState(() => (victory ? 0 : bounty))

  // Count-up animation for bounty
  useEffect(() => {
    if (!victory) return

    const duration = 1200
    const startTime = performance.now()
    let frameId = 0

    const update = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(1, elapsed / duration)
      const ease = 1 - Math.pow(1 - progress, 3)
      setDisplayedBounty(Math.floor(bounty * ease))

      if (progress < 1) {
        frameId = requestAnimationFrame(update)
      } else {
        setDisplayedBounty(bounty)
        sfx.coin()
      }
    }

    frameId = requestAnimationFrame(update)
    return () => cancelAnimationFrame(frameId)
  }, [bounty, victory])

  const myId = getPlayerId()
  const hasPersonalRank = !!(board && (board.draw || board.bounty))
  const hasTopLists =
    !!(board && ((board.topDraw?.length ?? 0) > 0 || (board.topBounty?.length ?? 0) > 0))

  return (
    <div className={`screen ending-screen ${victory ? 'is-win' : 'is-lose'}`}>
      {/* Header */}
      <div className="ending-header-compact">
        {victory ? (
          <div className="legend-star-badge-inline">
            <span className="star-symbol">★</span>
            <span className="badge-txt">IMMORTAL LEGEND</span>
            <span className="star-symbol">★</span>
          </div>
        ) : (
          <p className="eyebrow">{t('end.grave')}</p>
        )}
        <h1 className="ending-hero-title">
          {victory
            ? t('end.winTitle', { name: hero })
            : t('end.loseTitle', { name: hero })}
        </h1>
        <p className="ending-hero-sub">
          {victory ? t('end.winSub') : t('end.loseSub')}
        </p>
      </div>

      {/* Main 2-Column Dashboard Grid */}
      <div className="ending-main-grid">
        {/* Left Column: Stats & Perks & Quote */}
        <div className="ending-left-panel">
          {board && (hasPersonalRank || hasTopLists) && (
            <div className="registry-board">
              <span className="registry-board-label">{t('end.registry')}</span>
              {hasPersonalRank && (
                <div className="registry-cols">
                  {board.draw && (
                    <div className="registry-col">
                      <span className="registry-col-name">{t('end.myDraw')}</span>
                      <strong className="registry-col-rank">{t('rank.nth', { n: board.draw.rank })}</strong>
                      <span className="registry-col-val">{board.draw.value}ms</span>
                    </div>
                  )}
                  {board.bounty && (
                    <div className="registry-col">
                      <span className="registry-col-name">{t('end.myBounty')}</span>
                      <strong className="registry-col-rank">{t('rank.nth', { n: board.bounty.rank })}</strong>
                      <span className="registry-col-val">${board.bounty.value.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )}
              {hasTopLists && (
                <div className="registry-toplists">
                  <TopList
                    title={t('end.topDraw')}
                    entries={board.topDraw ?? []}
                    formatValue={(v) => `${v}ms`}
                    myId={myId}
                  />
                  <TopList
                    title={t('end.topBounty')}
                    entries={board.topBounty ?? []}
                    formatValue={(v) => `$${v.toLocaleString()}`}
                    myId={myId}
                  />
                </div>
              )}
              <button
                type="button"
                className="registry-more"
                onClick={() => {
                  sfx.click()
                  setShowRanking(true)
                }}
              >
                {t('end.more')}
              </button>
            </div>
          )}

          {showRanking && <RankingModal onClose={() => setShowRanking(false)} />}

          <div className="ending-stats-compact">
            <div className="stat-card">
              <span className="stat-label">{t('end.duelWins')}</span>
              <strong className="stat-val">{wins}</strong>
            </div>
            <div className="stat-card">
              <span className="stat-label">{t('end.peaces')}</span>
              <strong className="stat-val">{peaces}</strong>
            </div>
            <div className="stat-card highlight">
              <span className="stat-label">{t('end.bounty')}</span>
              <strong className="stat-val bounty-val">${displayedBounty.toLocaleString()}</strong>
            </div>
            <div className="stat-card">
              <span className="stat-label">{t('end.fame')}</span>
              <strong className="stat-val fame-val" style={{ color: runFame.color }}>
                {runFame.badge}
              </strong>
            </div>
          </div>

          {/* Equipped Perks Strip */}
          {perks.length > 0 && (
            <div className="ending-perks-compact">
              <span className="ending-section-label">{t('end.gear')}</span>
              <div className="perk-chips-row">
                {perks.map((id) => {
                  const perk = localizedPerk(id, t)
                  return (
                    <span key={id} className="perk-chip" title={perk.desc}>
                      <PerkIcon id={id} size={14} />
                      <strong>{perk.name}</strong>
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          {/* Chronicle Quote Box */}
          <div className="ending-chronicle-compact">
            <p className="blurb">
              {victory
                ? t('end.winQuote')
                : t('end.loseQuote')}
            </p>
          </div>
        </div>

        {/* Right Column: Record Board */}
        <div className="ending-right-panel">
          <RecordBoard career={career} lastRun={lastRun} compact />
        </div>
      </div>

      {/* Footer Actions */}
      <div className="ending-actions-compact">
        {victory && onReplayCutscene && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              sfx.click()
              onReplayCutscene()
            }}
          >
            {t('end.replay')}
          </button>
        )}
        <button
          type="button"
          className="btn primary pulse ending-restart-btn"
          onClick={() => {
            sfx.click()
            onRestart()
          }}
        >
          {t('end.retry')}
        </button>
      </div>
    </div>
  )
}
