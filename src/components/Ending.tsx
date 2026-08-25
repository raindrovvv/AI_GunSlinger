import { useEffect, useState } from 'react'
import { sfx } from '../audio/sfx'
import { getFameInfo } from '../data/fame'
import { perkById } from '../data/perks'
import type { CareerStats, PerkId, RunRecord } from '../types'
import { PerkIcon } from './PerkIcon'
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

export function Ending({
  wins,
  peaces,
  bounty,
  perks,
  victory,
  career,
  lastRun,
  playerName = '이름 없는 총잡이',
  onRestart,
  onReplayCutscene,
}: Props) {
  const runFame = getFameInfo(lastRun.bestStreak)
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
          <p className="eyebrow">BOOT HILL · 황야의 묘지</p>
        )}
        <h1 className="ending-hero-title">
          {victory
            ? `${playerName}, 마을의 전설이 되다`
            : `${playerName}, 먼지가 되었다`}
        </h1>
        <p className="ending-hero-sub">
          {victory
            ? '모든 무법자를 꺾고 더스트 타운에 영원한 평화를 가져온 진정한 영웅'
            : '거친 서부의 총구 앞에 스러진 또 하나의 방랑자'}
        </p>
      </div>

      {/* Main 2-Column Dashboard Grid */}
      <div className="ending-main-grid">
        {/* Left Column: Stats & Perks & Quote */}
        <div className="ending-left-panel">
          <div className="ending-stats-compact">
            <div className="stat-card">
              <span className="stat-label">결투 승리</span>
              <strong className="stat-val">{wins}</strong>
            </div>
            <div className="stat-card">
              <span className="stat-label">평화 해결</span>
              <strong className="stat-val">{peaces}</strong>
            </div>
            <div className="stat-card highlight">
              <span className="stat-label">누적 현상금</span>
              <strong className="stat-val bounty-val">${displayedBounty.toLocaleString()}</strong>
            </div>
            <div className="stat-card">
              <span className="stat-label">최고 명성</span>
              <strong className="stat-val fame-val" style={{ color: runFame.color }}>
                {runFame.badge}
              </strong>
            </div>
          </div>

          {/* Equipped Perks Strip */}
          {perks.length > 0 && (
            <div className="ending-perks-compact">
              <span className="ending-section-label">장착 전리품</span>
              <div className="perk-chips-row">
                {perks.map((id) => {
                  const perk = perkById(id)
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
                ? '“그의 손은 번개보다 빨랐고, 그의 눈은 석양보다 날카로웠다. 더스트 타운의 거리는 그의 이름을 영원히 기억할 것이다.”'
                : '서부는 잔인하다. 바람 속에 흩어진 이름을 다시 새기기 위해 홀스터를 고쳐 매라.'}
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
            🎬 컷씬 다시보기
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
          처음부터 다시 도전 ➔
        </button>
      </div>
    </div>
  )
}
