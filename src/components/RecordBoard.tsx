import { getFameInfo } from '../data/fame'
import { perkById } from '../data/perks'
import { formatReaction, formatRunDate } from '../data/records'
import type { CareerStats, RunRecord } from '../types'
import { PerkIcon } from './PerkIcon'

interface Props {
  career: CareerStats
  /** Ending 화면에서 방금 저장한 런 + 최고 기록 비교 */
  lastRun?: RunRecord | null
  compact?: boolean
}

function isNewBest(run: RunRecord, career: CareerStats, field: 'bounty' | 'reaction' | 'streak') {
  if (field === 'bounty') return run.bounty > 0 && run.bounty >= career.bestBounty
  if (field === 'streak') return run.bestStreak > 0 && run.bestStreak >= career.bestStreak
  if (run.bestReactionMs == null || career.bestReactionMs == null) return false
  return run.bestReactionMs <= career.bestReactionMs
}

export function RecordBoard({ career, lastRun = null, compact = false }: Props) {
  const empty = career.runs === 0 && !lastRun
  const careerFame = getFameInfo(career.bestStreak)

  return (
    <div className={`record-board ${compact ? 'is-compact' : ''}`}>
      <h3 className="record-title">전적</h3>

      {empty ? (
        <p className="record-empty">아직 기록이 없다. 홀스터를 잡고 첫 결투를 남겨라.</p>
      ) : (
        <>
          <div className="record-stats">
            <div>
              <span>출전</span>
              <strong>{career.runs}</strong>
            </div>
            <div>
              <span>완주</span>
              <strong>{career.victories}</strong>
            </div>
            <div>
              <span>전사</span>
              <strong>{career.defeats}</strong>
            </div>
            <div>
              <span>최고 현상금</span>
              <strong>${career.bestBounty.toLocaleString()}</strong>
            </div>
            <div>
              <span>최속 드로우</span>
              <strong>{formatReaction(career.bestReactionMs)}</strong>
            </div>
            <div>
              <span>최고 명성</span>
              <strong style={{ color: careerFame.color }}>
                {career.bestStreak ? `${careerFame.badge}` : '—'}
              </strong>
            </div>
          </div>

          {lastRun && (
            <div className="record-compare">
              <p className="record-compare-label">이번 런</p>
              <ul>
                <li>
                  현상금 ${lastRun.bounty.toLocaleString()}
                  {isNewBest(lastRun, career, 'bounty') && (
                    <em className="record-best">NEW BEST</em>
                  )}
                </li>
                <li>
                  최속 {formatReaction(lastRun.bestReactionMs)}
                  {isNewBest(lastRun, career, 'reaction') && (
                    <em className="record-best">NEW BEST</em>
                  )}
                </li>
                <li>
                  연승 {lastRun.bestStreak || 0}
                  {isNewBest(lastRun, career, 'streak') && (
                    <em className="record-best">NEW BEST</em>
                  )}
                </li>
                <li>
                  결투 {lastRun.wins} · 평화 {lastRun.peaces} · R{lastRun.roundsReached}
                </li>
              </ul>
            </div>
          )}

          {career.recent.length > 0 && (
            <div className="record-recent">
              <p className="record-compare-label">최근 기록</p>
              <ul>
                {career.recent.slice(0, compact ? 3 : 6).map((run) => (
                  <li key={run.id}>
                    <span className={run.victory ? 'is-win' : 'is-lose'}>
                      {run.victory ? '완주' : '전사'}
                    </span>
                    <span>${run.bounty.toLocaleString()}</span>
                    <span>{formatReaction(run.bestReactionMs)}</span>
                    <span className="record-date">{formatRunDate(run.at)}</span>
                    {run.perks.length > 0 && (
                      <span className="record-perks" title={run.perks.map((id) => perkById(id).name).join(', ')}>
                        {run.perks.slice(0, 3).map((id) => (
                          <PerkIcon key={id} id={id} size={12} />
                        ))}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
