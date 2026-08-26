import { useState } from 'react'
import { DEFAULT_PLAYER_NAME } from '../../shared/game'
import { sfx } from '../audio/sfx'
import { loadPlayerNameDraft, savePlayerName } from '../storage/playerName'
import { EMPTY_CAREER, loadCareer } from '../data/records'
import type { CareerStats } from '../types'
import { TitleFx } from '../gl/TitleFx'
import { skyFxEnabled } from '../gl/flags'
import { RankingModal } from './RankingModal'
import { RecordBoard } from './RecordBoard'

interface Props {
  onStart: (playerName?: string) => void
}

export function TitleScreen({ onStart }: Props) {
  const [showRecords, setShowRecords] = useState(false)
  const [showRanking, setShowRanking] = useState(false)
  const [career, setCareer] = useState<CareerStats>(EMPTY_CAREER)
  const [glSky] = useState(skyFxEnabled)
  const [fxOn, setFxOn] = useState(false)
  const [playerName, setPlayerName] = useState(loadPlayerNameDraft)

  const handleBegin = (skip = false) => {
    sfx.unlock()
    sfx.click()
    sfx.gunLoad(0.7)
    const trimmed = playerName.trim()
    const finalName = skip || !trimmed ? DEFAULT_PLAYER_NAME : trimmed
    if (!skip && trimmed) savePlayerName(trimmed)
    onStart(finalName)
  }

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
          <img
            className="logo-mark"
            src="/logo.webp"
            alt="AI GUNSLINGER"
            width={1190}
            height={371}
            decoding="async"
            fetchPriority="high"
          />
        </h1>
        <p className="tagline">말빨로 멘탈 흔들고, 0.2초 만에 쏴라!</p>
        <p className="blurb">
          매 판 살아 숨 쉬는 <strong>생성형 AI 무법자</strong>와의 숨 막히는 심리전!
          <br />
          약점을 찔러 멘탈을 흔들거나, 번개 같은 <strong>0.2초 드로우</strong>로 제압하라.
        </p>

        <div className="player-setup">
          <label htmlFor="player-name-input" className="player-name-label">
            당신의 총잡이 이름
          </label>
          <div className="player-name-box">
            <input
              id="player-name-input"
              type="text"
              className="player-name-input"
              placeholder={DEFAULT_PLAYER_NAME}
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleBegin(false)
              }}
              maxLength={12}
            />
          </div>
        </div>

        <div className="title-actions">
          <button className="btn primary pulse" onClick={() => handleBegin(false)}>
            {playerName.trim() ? `${playerName.trim()}로 결투 시작` : '결투 시작'}
          </button>
          <button className="btn outline" onClick={() => handleBegin(true)}>
            이름 없이 시작 (스킵)
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
          <button
            className="btn"
            onClick={() => {
              sfx.click()
              setShowRanking(true)
            }}
          >
            랭킹
          </button>
        </div>

        {showRecords && (
          <div className="title-records">
            <RecordBoard career={career} />
          </div>
        )}

        {showRanking && <RankingModal onClose={() => setShowRanking(false)} />}

        <div className="howto">
          <h3>⚡ HOW TO PLAY — 결투 조작 핵심 가이드</h3>
          <ol>
            <li>
              <strong>1. [홀스터 꾹 누르기]</strong> 결투 시작 시 우측 하단의 <strong>홀스터를 마우스로 꾹 누른 채(HOLD)</strong> 대기하세요. (카운트 중 미리 떼면 <em>반칙 패배</em>)
            </li>
            <li>
              <strong>2. [진짜 DRAW! 확인]</strong> 페이크 신호(<em>DRAW…?</em>)에 속지 말고, 화면에 빨간색 <strong>진짜 DRAW!</strong>가 뜨는 순간 <strong>즉시 손을 뗍니다!</strong>
            </li>
            <li>
              <strong>3. [조준 & 광속 클릭]</strong> 손을 뗀 직후 마우스로 <strong>상대 몸통(또는 노란색 머리)을 즉시 클릭</strong>해 사격하세요! (머리 명중 시 <strong>헤드샷 보너스</strong>)
            </li>
            <li>
              <strong>4. [심리전 꿀팁]</strong> 결투 직전 <strong>대치 3턴</strong> 동안 상대의 <strong>버릇/약점을 찔러</strong> 상대 반응속도를 늦추고 조준을 흔드세요!
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
