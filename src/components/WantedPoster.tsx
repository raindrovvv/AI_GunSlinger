import { sfx } from '../audio/sfx'
import { portraitSrc } from '../data/portraits'
import type { Opponent } from '../types'

interface Props {
  opponent: Opponent
  round: number
  usedAi: boolean
  onContinue: () => void
}

export function WantedPoster({ opponent, round, usedAi, onContinue }: Props) {
  return (
    <div className="screen wanted-screen">
      <p className="eyebrow">
        ROUND {round} / 9 · {usedAi ? 'AI GENERATED' : 'FALLBACK DECK'}
      </p>
      <article className="wanted-poster">
        <div className="wanted-stamp">DEAD OR ALIVE</div>
        <header>WANTED</header>
        <div className="mugshot" aria-hidden>
          <img
            className="mugshot-portrait"
            src={portraitSrc(opponent, round)}
            alt=""
            width={512}
            height={512}
            decoding="async"
          />
          <div className="mugshot-grain" />
        </div>
        <h2>{opponent.name}</h2>
        <p className="alias">「{opponent.alias}」</p>
        <p className="bounty">
          REWARD <strong>${opponent.bounty.toLocaleString()}</strong>
        </p>
        <dl>
          <div>
            <dt>죄목</dt>
            <dd>{opponent.crime}</dd>
          </div>
          <div>
            <dt>외모</dt>
            <dd>{opponent.appearance}</dd>
          </div>
          <div className="tell">
            <dt>드로우 직전 버릇</dt>
            <dd>{opponent.tell}</dd>
            <p className="tell-note">
              결투에서 이 동작이 보이면 곧 총을 뽑는다. 대치에서 짚어주면 상대가 동요한다.
            </p>
          </div>
        </dl>
        <blockquote>“{opponent.taunt}”</blockquote>
      </article>
      <button
        className="btn primary"
        onClick={() => {
          sfx.click()
          onContinue()
        }}
      >
        거리로 나서기
      </button>
    </div>
  )
}
