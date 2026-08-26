import { useState } from 'react'
import { sfx } from '../audio/sfx'
import { useT } from '../i18n/LocaleContext'
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
  const t = useT()
  const defaultName = t('player.default')
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
    const finalName = skip || !trimmed ? defaultName : trimmed
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
        <p className="tagline">{t('title.tagline')}</p>
        <p className="blurb">
          {t('title.blurb1')} <strong>{t('title.blurbStrong1')}</strong>{t('title.blurb2')}
          <br />
          {t('title.blurb3')} <strong>{t('title.blurbStrong2')}</strong>{t('title.blurb4')}
        </p>

        <div className="player-setup">
          <label htmlFor="player-name-input" className="player-name-label">
            {t('title.nameLabel')}
          </label>
          <div className="player-name-box">
            <input
              id="player-name-input"
              type="text"
              className="player-name-input"
              placeholder={defaultName}
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
            {playerName.trim() ? t('title.startNamed', { name: playerName.trim() }) : t('title.start')}
          </button>
          <button className="btn outline" onClick={() => handleBegin(true)}>
            {t('title.skip')}
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
            {showRecords ? t('title.close') : t('title.records')}
          </button>
          <button
            className="btn"
            onClick={() => {
              sfx.click()
              setShowRanking(true)
            }}
          >
            {t('title.ranking')}
          </button>
        </div>

        {showRecords && (
          <div className="title-records">
            <RecordBoard career={career} />
          </div>
        )}

        {showRanking && <RankingModal onClose={() => setShowRanking(false)} />}

        <div className="howto">
          <h3>⚡ {t('title.howto')}</h3>
          <ol>
            <li>
              <strong>{t('title.how1t')}</strong> {t('title.how1', { hold: t('title.hold'), foul: t('title.foul') })}
            </li>
            <li>
              <strong>{t('title.how2t')}</strong> {t('title.how2', { fake: t('title.fake'), real: t('title.real'), release: t('title.release') })}
            </li>
            <li>
              <strong>{t('title.how3t')}</strong> {t('title.how3', { aim: t('title.aim'), hs: t('title.hs') })}
            </li>
            <li>
              <strong>{t('title.how4t')}</strong> {t('title.how4', { turns: t('title.turns'), tell: t('title.tell') })}
            </li>
          </ol>
          <p className="howto-tip">{t('title.howFullscreen')}</p>
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
