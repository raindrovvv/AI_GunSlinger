import { useEffect, useState } from 'react'
import { sfx } from '../audio/sfx'
import { perkById } from '../data/perks'
import { PerkIcon } from './PerkIcon'
import { downloadNewspaperImage } from '../canvas/newspaperImage'
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
    downloadNewspaperImage({
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
