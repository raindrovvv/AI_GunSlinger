import { useEffect } from 'react'
import { sfx } from '../audio/sfx'
import { perkById } from '../data/perks'
import { PerkIcon } from './PerkIcon'
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
  useEffect(() => {
    sfx.paper()
  }, [])

  const status = peace ? 'PEACE' : playerWon ? 'VICTORY' : 'DEFEAT'
  const showPicker = perkChoices.length > 0

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
