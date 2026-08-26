import { localizedFame, localizedPerk } from '../i18n/content'
import { useT } from '../i18n/LocaleContext'
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
  const t = useT()
  const empty = career.runs === 0 && !lastRun
  const careerFame = localizedFame(career.bestStreak, t)

  return (
    <div className={`record-board ${compact ? 'is-compact' : ''}`}>
      <h3 className="record-title">{t('record.title')}</h3>

      {empty ? (
        <p className="record-empty">{t('record.empty')}</p>
      ) : (
        <>
          <div className="record-stats">
            <div>
              <span>{t('record.runs')}</span>
              <strong>{career.runs}</strong>
            </div>
            <div>
              <span>{t('record.wins')}</span>
              <strong>{career.victories}</strong>
            </div>
            <div>
              <span>{t('record.deaths')}</span>
              <strong>{career.defeats}</strong>
            </div>
            <div>
              <span>{t('record.bestBounty')}</span>
              <strong>${career.bestBounty.toLocaleString()}</strong>
            </div>
            <div>
              <span>{t('record.bestDraw')}</span>
              <strong>{formatReaction(career.bestReactionMs)}</strong>
            </div>
            <div>
              <span>{t('record.bestFame')}</span>
              <strong style={{ color: careerFame.color }}>
                {career.bestStreak ? `${careerFame.badge}` : '—'}
              </strong>
            </div>
          </div>

          {lastRun && (
            <div className="record-compare">
              <p className="record-compare-label">{t('record.thisRun')}</p>
              <ul>
                <li>
                  {t('record.bounty', { n: lastRun.bounty.toLocaleString() })}
                  {isNewBest(lastRun, career, 'bounty') && (
                    <em className="record-best">NEW BEST</em>
                  )}
                </li>
                <li>
                  {t('record.fast', { ms: formatReaction(lastRun.bestReactionMs) })}
                  {isNewBest(lastRun, career, 'reaction') && (
                    <em className="record-best">NEW BEST</em>
                  )}
                </li>
                <li>
                  {t('record.streak', { n: lastRun.bestStreak || 0 })}
                  {isNewBest(lastRun, career, 'streak') && (
                    <em className="record-best">NEW BEST</em>
                  )}
                </li>
                <li>
                  {t('record.line', { w: lastRun.wins, p: lastRun.peaces, r: lastRun.roundsReached })}
                </li>
              </ul>
            </div>
          )}

          {career.recent.length > 0 && (
            <div className="record-recent">
              <p className="record-compare-label">{t('record.recent')}</p>
              <ul>
                {career.recent.slice(0, compact ? 3 : 6).map((run) => (
                  <li key={run.id}>
                    <span className={run.victory ? 'is-win' : 'is-lose'}>
                      {run.victory ? t('record.wins') : t('record.deaths')}
                    </span>
                    <span>${run.bounty.toLocaleString()}</span>
                    <span>{formatReaction(run.bestReactionMs)}</span>
                    <span className="record-date">{formatRunDate(run.at)}</span>
                    {run.perks.length > 0 && (
                      <span className="record-perks" title={run.perks.map((id) => localizedPerk(id, t).name).join(', ')}>
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
