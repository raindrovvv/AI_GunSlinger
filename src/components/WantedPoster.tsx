import { TOTAL_ROUNDS } from '../../shared/game'
import { sfx } from '../audio/sfx'
import { portraitSrc } from '../data/portraits'
import { displayOpponent } from '../i18n/content'
import { useLocale } from '../i18n/LocaleContext'
import type { Opponent } from '../types'

interface Props {
  opponent: Opponent
  round: number
  usedAi: boolean
  onContinue: () => void
}

export function WantedPoster({ opponent, round, usedAi, onContinue }: Props) {
  const { locale, t } = useLocale()
  const face = displayOpponent(opponent, locale)
  return (
    <div className="screen wanted-screen">
      <p className="eyebrow">
        ROUND {round} / {TOTAL_ROUNDS} · {usedAi ? 'AI GENERATED' : 'FALLBACK DECK'}
      </p>
      <article className="wanted-poster">
        <span className="wanted-nail" aria-hidden />
        <p className="wanted-masthead">{t('wanted.masthead')}</p>
        <header>
          <span>WANTED</span>
        </header>
        <p className="wanted-or">DEAD OR ALIVE</p>
        <div className="wanted-stamp" aria-hidden>
          <em>SHERIFF</em>
          <strong>DEAD OR ALIVE</strong>
        </div>

        <div className="wanted-identity">
          <div className="mugshot" aria-hidden>
            <img
              className="mugshot-portrait"
              src={portraitSrc(face, round)}
              alt=""
              width={512}
              height={512}
              decoding="async"
            />
            <div className="mugshot-grain" />
            <div className="mugshot-corners" />
          </div>
          <div className="wanted-names">
            <h2>{face.name}</h2>
            <p className="alias">「{face.alias}」</p>
            <p className="bounty">
              <span>{t('wanted.reward')}</span>
              <strong>${face.bounty.toLocaleString()}</strong>
            </p>
          </div>
        </div>

        <dl>
          <div>
            <dt>{t('wanted.crime')}</dt>
            <dd>{face.crime}</dd>
          </div>
          <div>
            <dt>{t('wanted.looks')}</dt>
            <dd>{face.appearance}</dd>
          </div>
          <div className="tell">
            <dt>{t('wanted.tell')}</dt>
            <dd>{face.tell}</dd>
            <p className="tell-note">{t('wanted.tellNote')}</p>
          </div>
        </dl>
        <blockquote>“{face.taunt}”</blockquote>
        <p className="wanted-foot">{t('wanted.foot')}</p>
      </article>
      <button
        className="btn primary"
        onClick={() => {
          sfx.click()
          onContinue()
        }}
      >
        {t('wanted.next')}
      </button>
    </div>
  )
}
