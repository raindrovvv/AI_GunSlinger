import { useEffect, useState } from 'react'
import { sfx } from '../audio/sfx'
import {
  SECTOR_META,
  fetchTop,
  formatRank,
  getPlayerId,
  type SectorKey,
  type TopResult,
} from '../data/ranking'

/**
 * 서부 명부 — 세계 랭킹 모달
 *
 * 타이틀과 엔딩 양쪽에서 같은 컴포넌트를 띄운다. 모달로 만든 이유는
 * 두 화면 모두 세로 여유가 없어서다. 엔딩은 900px에 이미 꽉 차 있고
 * (.ending-screen이 overflow: hidden이라 넘치면 잘린다), 타이틀은 로고가
 * 위를 차지해 인라인으로 넣으면 목록이 화면 밖으로 밀린다.
 * 오버레이는 주변 레이아웃과 무관하므로 두 화면 모두 비용 0으로 붙는다.
 *
 * 세 섹터를 탭 없이 한 번에 펼친다. 좁은 화면에서는 가로 3분할이면 닉네임
 * 칸이 14px까지 뭉개져서, CSS에서 세로 스택으로 바꾼다.
 */

const SECTORS: SectorKey[] = ['draw', 'bounty', 'wins']

interface Props {
  onClose: () => void
}

export function RankingModal({ onClose }: Props) {
  const [data, setData] = useState<TopResult | null>(null)
  const [failed, setFailed] = useState(false)
  // 서버가 내려준 id와 대조해 내 행을 찾는다. 닉네임이 겹쳐도 오작동하지 않는다.
  const myId = getPlayerId()

  useEffect(() => {
    let alive = true
    fetchTop().then((r) => {
      if (!alive) return
      if (r) setData(r)
      else setFailed(true)
    })
    return () => {
      alive = false
    }
  }, [])

  // ESC로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const close = () => {
    sfx.click()
    onClose()
  }

  return (
    <div
      className="ranking-modal"
      role="dialog"
      aria-modal="true"
      aria-label="서부 명부 세계 랭킹"
      onClick={close}
    >
      {/* 내용 클릭이 배경까지 올라가 닫히지 않게 막는다 */}
      <div className="ranking-box" onClick={(e) => e.stopPropagation()}>
        <header className="ranking-head">
          <strong>서부 명부 · 세계 랭킹</strong>
          <button type="button" className="ranking-close" onClick={close} aria-label="닫기">
            ✕
          </button>
        </header>

        {!data && !failed && <p className="ranking-msg">명부를 넘기는 중…</p>}
        {failed && (
          <p className="ranking-msg">
            명부를 불러오지 못했다. 전신이 끊긴 모양이다.
          </p>
        )}

        {data && (
          <div className="ranking-cols">
            {SECTORS.map((key) => {
              const meta = SECTOR_META[key]
              const rows = data.top[key] ?? []
              const mine = data.mine[key]
              // 내가 이미 목록 안에 있으면 하단에 또 보여줄 필요가 없다
              const inList = rows.some((r) => r.id === myId)
              return (
                <section className="ranking-col" key={key}>
                  <h3>{meta.label}</h3>
                  <div className="ranking-list">
                    {rows.length === 0 && <p className="ranking-empty">아직 아무도 없다</p>}
                    {rows.map((r) => (
                      <div
                        key={`${key}-${r.rank}`}
                        className={`ranking-row${r.id === myId ? ' is-me' : ''}`}
                      >
                        <span className="rk-no">{r.rank}</span>
                        <span className="rk-name">{r.name}</span>
                        <span className="rk-val">{meta.format(r.value)}</span>
                      </div>
                    ))}
                  </div>
                  {mine && !inList && (
                    <div className="ranking-row is-mine-pinned">
                      <span className="rk-no">{formatRank(mine.rank).replace('위', '')}</span>
                      <span className="rk-name">나</span>
                      <span className="rk-val">{meta.format(mine.value)}</span>
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
