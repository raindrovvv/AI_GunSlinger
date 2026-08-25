import { sfx } from '../audio/sfx'
import type { Opponent } from '../types'

interface Props {
  opponent: Opponent
  round: number
  usedAi: boolean
  onContinue: () => void
}

function hash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

function MugshotSeed({ seed }: { seed: string }) {
  const h = hash(seed)
  const coat = ['#6b4423', '#3a4a3a', '#4a2a2a', '#2a2a3a', '#5a3a1a'][h % 5]
  const hat = h % 3
  const patch = h % 2 === 0
  return (
    <svg className="mugshot-svg" viewBox="0 0 80 100" width="100" height="110">
      <ellipse cx="40" cy="92" rx="22" ry="5" fill="rgba(0,0,0,0.2)" />
      <rect x="28" y="48" width="24" height="36" rx="2" fill={coat} />
      <circle cx="40" cy="36" r="14" fill="#e0b890" />
      {hat === 0 && (
        <>
          <ellipse cx="40" cy="26" rx="22" ry="4" fill="#1a1008" />
          <rect x="30" y="10" width="20" height="16" fill="#1a1008" />
        </>
      )}
      {hat === 1 && (
        <>
          <ellipse cx="40" cy="24" rx="18" ry="5" fill="#1a1008" />
          <path d="M22 24 Q40 8 58 24" fill="#1a1008" />
        </>
      )}
      {hat === 2 && <circle cx="40" cy="20" r="12" fill="#2a1a10" />}
      {patch && <rect x="28" y="32" width="12" height="5" fill="#111" />}
      <rect x="34" y="44" width="12" height="6" fill="#8b1e1e" />
    </svg>
  )
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
          <MugshotSeed seed={opponent.alias + opponent.name} />
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
