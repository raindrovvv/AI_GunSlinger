import { useState } from 'react'
import { sfx } from '../audio/sfx'
import { EMPTY_CAREER, loadCareer } from '../data/records'
import type { CareerStats } from '../types'
import { TitleFx } from '../gl/TitleFx'
import { skyFxEnabled } from '../gl/flags'
import { RecordBoard } from './RecordBoard'

interface Props {
  onStart: () => void
}

export function TitleScreen({ onStart }: Props) {
  const [showRecords, setShowRecords] = useState(false)
  const [career, setCareer] = useState<CareerStats>(EMPTY_CAREER)
  const [glSky] = useState(skyFxEnabled)
  const [fxOn, setFxOn] = useState(false)

  return (
    <div className={`title-page${fxOn ? ' fx-on' : ''}`}>
      <div className="title-backdrop" aria-hidden>
        {glSky && <TitleFx onReady={setFxOn} />}
        <div className="title-sky" />
        <div className="title-horizon" />
        <div className="dust-layer" />
        <TitleSkyline />
      </div>

      <div className="screen title-screen">
        <div className="title-badge">OPENAI GAME BUILDERS SEOUL · 2026</div>
        <h1 className="logo">
          <span className="logo-ai">AI</span>
          <span className="logo-gun">GUNSLINGER</span>
        </h1>
        <p className="tagline">말로 흔들고, 총으로 끝낸다.</p>
        <p className="blurb">
          매 결투마다 AI가 새로운 무법자를 만든다.
          <br />
          드로우 전 심리전으로 상대를 흔들거나 — 총 없이 설득하라.
        </p>
        <div className="title-actions">
          <button
            className="btn primary pulse"
            onClick={() => {
              sfx.unlock()
              sfx.click()
              sfx.gunLoad(0.7)
              onStart()
            }}
          >
            결투 시작
          </button>
          <button
            className="btn"
            onClick={() => {
              sfx.click()
              setShowRecords((v) => {
                if (!v) setCareer(loadCareer())
                return !v
              })
            }}
          >
            {showRecords ? '닫기' : '전적'}
          </button>
        </div>

        {showRecords && (
          <div className="title-records">
            <RecordBoard career={career} />
          </div>
        )}

        <div className="howto">
          <h3>HOW TO PLAY</h3>
          <ol>
            <li>
              수배서에서 상대의 <em>버릇</em>을 확인하세요 — 총을 뽑기 직전에 나오는 동작입니다
            </li>
            <li>대치에서 말로 심리를 흔드세요 (3턴)</li>
            <li>
              홀스터를 <em>누른 채 버티기</em> — 손을 떼거나 벗어나면 반칙
            </li>
            <li>
              가짜 신호 <em>DRAW…?</em>에 속지 말고, 진짜 DRAW!에 상대를 클릭
            </li>
            <li>
              노란 원(머리)을 맞히면 <em>헤드샷 보너스</em>
            </li>
          </ol>
        </div>
      </div>
    </div>
  )
}

/** 타이틀 하단에 깔리는 마을 실루엣. 결투 배경과 같은 세계임을 알린다. */
function TitleSkyline() {
  return (
    <svg
      className="title-skyline"
      viewBox="0 0 1200 160"
      preserveAspectRatio="none"
      aria-hidden
    >
      <g fill="#0a0503">
        <rect x="40" y="66" width="150" height="94" />
        <path d="M40 66 L115 40 L190 66 Z" />
        <rect x="200" y="88" width="96" height="72" />
        <rect x="306" y="74" width="120" height="86" />
        <path d="M306 74 L366 52 L426 74 Z" />
        <rect x="770" y="82" width="110" height="78" />
        <rect x="890" y="60" width="160" height="100" />
        <path d="M890 60 L970 34 L1050 60 Z" />
        <rect x="1060" y="94" width="110" height="66" />
        <rect x="470" y="120" width="8" height="40" />
        <path d="M474 120 l-26 -14 l26 -8 l26 8 z" />
        <rect x="700" y="112" width="10" height="48" />
        <path d="M690 112 h30 l-15 -20 z" />
      </g>
      {/* 지붕선을 스치는 역광 */}
      <g fill="rgba(255, 190, 110, 0.5)">
        <rect x="40" y="64" width="150" height="2" />
        <rect x="200" y="86" width="96" height="2" />
        <rect x="306" y="72" width="120" height="2" />
        <rect x="770" y="80" width="110" height="2" />
        <rect x="890" y="58" width="160" height="2" />
        <rect x="1060" y="92" width="110" height="2" />
      </g>
      <g fill="#1d2a16">
        <path d="M560 160 v-52 M560 132 h-22 v-22 M560 120 h20 v-20" stroke="#1d2a16" strokeWidth="9" strokeLinecap="round" />
        <path d="M650 160 v-38 M650 142 h16 v-16" stroke="#1d2a16" strokeWidth="7" strokeLinecap="round" />
      </g>
    </svg>
  )
}
