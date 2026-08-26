import { useEffect, useRef, useState } from 'react'
import { sfx } from '../audio/sfx'
import { perkById } from '../data/perks'
import { PerkIcon } from './PerkIcon'
import { downloadNewspaperImage } from '../canvas/newspaperImage'
import { halftone, loadImage } from '../canvas/halftone'
import { portraitSrc } from '../data/portraits'
import { pressPortraitEnabled } from '../gl/flags'
import type { DuelOutcome, NewspaperArticle, Opponent, PerkId } from '../types'

interface Props {
  article: NewspaperArticle
  opponent: Opponent
  playerWon: boolean
  peace: boolean
  usedAi: boolean
  round: number
  reward: number
  outcome: DuelOutcome | null
  perkChoices: PerkId[]
  pickedPerk: PerkId | null
  onPickPerk: (id: PerkId) => void
  onNext: () => void
  isLast: boolean
}

export function Newspaper({
  article,
  opponent,
  playerWon,
  peace,
  usedAi,
  round,
  reward,
  outcome,
  perkChoices,
  pickedPerk,
  onPickPerk,
  onNext,
  isLast,
}: Props) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    sfx.paper()
  }, [])

  const status = peace ? 'PEACE' : playerWon ? 'VICTORY' : 'DEFEAT'
  const showPicker = perkChoices.length > 0

  const handleCopyText = async () => {
    sfx.click()
    const text = [
      `📰 [DUST TOWN GAZETTE] ROUND ${round} 속보`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `[${status}] ${article.headline}`,
      `상대: ${opponent.alias} (현상금 $${opponent.bounty.toLocaleString()})`,
      ``,
      article.body,
      article.quote ? `\n"${article.quote}"` : '',
      `━━━━━━━━━━━━━━━━━━━━━━`,
      outcome?.reactionMs != null ? `⚡ 드로우 반응속도: ${outcome.reactionMs}ms` : '',
      outcome?.headshot ? `💥 헤드샷 명중!` : '',
      reward > 0 ? `💰 수령 현상금: $${reward.toLocaleString()}` : '',
      `👉 AI Gunslinger 플레이하기: https://ai-gunslinger.vercel.app`,
    ]
      .filter(Boolean)
      .join('\n')

    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2400)
    } catch {
      // Fallback
    }
  }

  const handleDownload = () => {
    sfx.click()
    void downloadNewspaperImage({
      article,
      opponent,
      playerWon,
      peace,
      round,
      reward,
      outcome,
    })
  }

  return (
    <div className="screen newspaper-screen">
      <p className="eyebrow">
        DUST TOWN GAZETTE · {usedAi ? 'AI PRESS' : 'LOCAL PRESS'} · ROUND {round}
      </p>

      <article className={`newspaper status-${status.toLowerCase()}`}>
        <header>
          <h1>DUST TOWN GAZETTE</h1>
          <p>Est. 1879 · Vol. XII · Special Edition</p>
        </header>
        <p className={`stamp stamp-${status.toLowerCase()}`}>{status}</p>
        <h2>{article.headline}</h2>
        <p className="byline">
          {opponent.alias} — 현상금 ${opponent.bounty.toLocaleString()}
        </p>
        <NewspaperMug opponent={opponent} round={round} />
        <p className="body">{article.body}</p>
        <blockquote>{article.quote}</blockquote>

        {(reward > 0 || outcome) && (
          <div className="ledger">
            {reward > 0 && (
              <span>
                수령 <strong>${reward.toLocaleString()}</strong>
              </span>
            )}
            {outcome?.reactionMs != null && (
              <span>
                드로우 <strong>{outcome.reactionMs}ms</strong>
              </span>
            )}
            {outcome?.grade && outcome.grade !== '-' && (
              <span className={`grade grade-${outcome.grade}`}>{outcome.grade}</span>
            )}
            {outcome?.headshot && <span className="ledger-head">HEADSHOT</span>}
          </div>
        )}
      </article>

      {/* 신문 복사 및 이미지 다운로드 액션 바 */}
      <div className="newspaper-actions">
        <button
          type="button"
          className="btn-newspaper-action"
          onClick={handleCopyText}
          title="신문 기사 텍스트를 클립보드에 복사합니다"
        >
          {copied ? '✓ 클립보드 복사 완료!' : '📋 기사 텍스트 복사'}
        </button>
        <button
          type="button"
          className="btn-newspaper-action"
          onClick={handleDownload}
          title="1880년대 빈티지 신문 그래픽 PNG 이미지로 저장합니다"
        >
          💾 신문 이미지 다운로드
        </button>
      </div>

      {showPicker && (
        <section className="perk-picker">
          <h3>{pickedPerk ? '장비를 챙겼다' : '전리품 — 하나만 챙길 수 있다'}</h3>
          <div className="perk-cards">
            {perkChoices.map((id) => {
              const perk = perkById(id)
              const selected = pickedPerk === id
              const dimmed = pickedPerk !== null && !selected
              return (
                <button
                  key={id}
                  type="button"
                  className={`perk-card${selected ? ' selected' : ''}${dimmed ? ' dimmed' : ''}`}
                  disabled={pickedPerk !== null}
                  onClick={() => {
                    sfx.click()
                    onPickPerk(id)
                  }}
                >
                  <PerkIcon id={id} />
                  <strong>{perk.name}</strong>
                  <span className="perk-desc">{perk.desc}</span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      <button
        className="btn primary pulse"
        onClick={() => {
          sfx.click()
          onNext()
        }}
      >
        {playerWon || peace ? (isLast ? '전설이 되다' : '더스트 타운 잡화점 들르기 ➔') : '무덤에서 다시'}
      </button>
    </div>
  )
}

/**
 * 신문에 실린 수배 사진.
 *
 * 1880년대 신문은 사진을 점의 크기로 바꿔 찍었다(하프톤). 초상화를 그대로
 * 얹으면 혼자 현대 이미지처럼 떠서, 같은 방식으로 굽어 종이에 인쇄된 것처럼
 * 만든다. 캔버스로 실제 점을 찍는 것이라 CSS 필터 흉내와 다르다.
 */
function NewspaperMug({ opponent, round }: { opponent: Opponent; round: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [on] = useState(pressPortraitEnabled)

  useEffect(() => {
    if (!on) return
    let alive = true
    const SIZE = 132

    void loadImage(portraitSrc(opponent, round)).then((img) => {
      if (!alive || !img) return
      const canvas = ref.current
      if (!canvas) return
      const plate = halftone(img, { size: SIZE, cell: 3, ink: '#1a0c06', paper: null })
      if (!plate) return
      canvas.width = SIZE
      canvas.height = SIZE
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(plate, 0, 0)
      canvas.dataset.ready = '1'
    })

    return () => {
      alive = false
    }
  }, [on, opponent, round])

  if (!on) return null
  return (
    <figure className="press-mug" aria-hidden>
      <canvas ref={ref} width={132} height={132} />
      <figcaption>{opponent.alias}</figcaption>
    </figure>
  )
}
