import { useEffect, useRef, useState } from 'react'
import { sfx } from '../audio/sfx'
import { localizedPerk } from '../i18n/content'
import { useT } from '../i18n/LocaleContext'
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
  const t = useT()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    sfx.paper()
  }, [])

  const status = peace ? 'PEACE' : playerWon ? 'VICTORY' : 'DEFEAT'
  const showPicker = perkChoices.length > 0

  const handleCopyText = async () => {
    sfx.click()
    const text = [
      t('paper.copyHead', { round }),
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `[${status}] ${article.headline}`,
      t('paper.copyOpp', { alias: opponent.alias, bounty: opponent.bounty.toLocaleString() }),
      ``,
      article.body,
      article.quote ? `\n"${article.quote}"` : '',
      `━━━━━━━━━━━━━━━━━━━━━━`,
      outcome?.reactionMs != null ? t('paper.copyMs', { ms: outcome.reactionMs }) : '',
      outcome?.headshot ? t('paper.copyHs') : '',
      reward > 0 ? t('paper.copyPay', { n: reward.toLocaleString() }) : '',
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
          {t('paper.byline', { alias: opponent.alias, bounty: opponent.bounty.toLocaleString() })}
        </p>
        <NewspaperMug opponent={opponent} round={round} />
        <p className="body">{article.body}</p>
        <blockquote>{article.quote}</blockquote>

        {(reward > 0 || outcome) && (
          <div className="ledger">
            {reward > 0 && (
              <span>
                {t('paper.reward')} <strong>${reward.toLocaleString()}</strong>
              </span>
            )}
            {outcome?.reactionMs != null && (
              <span>
                {t('paper.draw')} <strong>{outcome.reactionMs}ms</strong>
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
          title={t('paper.copyTip')}
        >
          {copied ? t('paper.copied') : t('paper.copy')}
        </button>
        <button
          type="button"
          className="btn-newspaper-action"
          onClick={handleDownload}
          title={t('paper.dlTip')}
        >
          {t('paper.download')}
        </button>
      </div>

      {showPicker && (
        <section className="perk-picker">
          <h3>{pickedPerk ? t('paper.picked') : t('paper.pick')}</h3>
          <div className="perk-cards">
            {perkChoices.map((id) => {
              const perk = localizedPerk(id, t)
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
        {playerWon || peace ? (isLast ? t('paper.nextLast') : t('paper.nextStore')) : t('paper.retry')}
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
