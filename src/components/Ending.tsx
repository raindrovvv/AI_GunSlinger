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
}: Props) {
  const runFame = getFameInfo(lastRun.bestStreak)

  return (
    <div className={`screen ending-screen ${victory ? 'is-win' : 'is-lose'}`}>
      <p className="eyebrow">{victory ? '★ LEGEND ★' : 'BOOT HILL'}</p>
      <h1>
        {victory
          ? `${playerName}, 마을의 전설이 되다`
          : `${playerName}, 먼지가 되었다`}
      </h1>

      <div className="ending-stats">
        <div>
          <span>결투 승리</span>
          <strong>{wins}</strong>
        </div>
        <div>
          <span>평화 해결</span>
          <strong>{peaces}</strong>
        </div>
        <div>
          <span>누적 현상금</span>
          <strong>${bounty.toLocaleString()}</strong>
        </div>
        <div>
          <span>최고 명성</span>
          <strong style={{ color: runFame.color }}>{runFame.badge}</strong>
        </div>
      </div>

      {perks.length > 0 && (
        <div className="perk-strip">
          {perks.map((id) => (
            <span key={id} className="perk-tag" title={perkById(id).desc}>
              <PerkIcon id={id} size={15} />
              {perkById(id).name}
            </span>
          ))}
        </div>
      )}

      <div className="ending-records">
        <RecordBoard career={career} lastRun={lastRun} compact />
      </div>

      <p className="blurb">
        {victory
          ? '9명의 무법자를 쓰러뜨리거나 설득했다. 서부는 당신의 이름을 기억할 것이다.'
          : '서부는 잔인하다. 홀스터를 다시 매고 일어서라.'}
      </p>
      <button
        className="btn primary"
        onClick={() => {
          sfx.click()
          onRestart()
        }}
      >
        처음부터
      </button>
    </div>
  )
}
