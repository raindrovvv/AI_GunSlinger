import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { TOTAL_ROUNDS } from '../shared/game'
import { checkAiHealth, generateNewspaper, generateOpponent } from './api/client'
import { getFameInfo } from './data/fame'
import { parsePreviewSearch } from './data/preview'
import { recordRun } from './data/records'
import { loadStoredPlayerName } from './storage/playerName'
import { applyEncounter, createInitialRun, runReducer } from './state/run'
import { Ending } from './components/Ending'
import { Duel } from './components/Duel'
import { Newspaper } from './components/Newspaper'
import { Standoff } from './components/Standoff'
import { Store } from './components/Store'
import { VictoryCutscene } from './components/VictoryCutscene'
import { TitleScreen } from './components/TitleScreen'
import { WantedPoster } from './components/WantedPoster'
import { Sandstorm } from './components/Sandstorm'
import { bgm } from './audio/bgm'
import { sfx } from './audio/sfx'
import type { ConsumableId, DuelMods, DuelOutcome, PerkId } from './types'
import './App.css'

export default function App() {
  const preview = typeof window !== 'undefined' ? parsePreviewSearch(window.location.search) : null
  const [run, dispatch] = useReducer(runReducer, undefined, () =>
    createInitialRun(loadStoredPlayerName(), preview),
  )
  const runRef = useRef(run)
  runRef.current = run

  const [aiReachable, setAiReachable] = useState<boolean | null>(null)
  const [bgmMuted, setBgmMuted] = useState(() => bgm.isMuted())
  const [bgmVolume, setBgmVolumeState] = useState(() => bgm.getVolume())

  useEffect(() => {
    void checkAiHealth().then(setAiReachable)
  }, [])

  useEffect(() => {
    const unsub = bgm.subscribe(() => {
      setBgmMuted(bgm.isMuted())
      setBgmVolumeState(bgm.getVolume())
    })
    return unsub
  }, [])

  useEffect(() => {
    if (run.phase === 'newspaper') {
      bgm.play(run.playerWon ? 'newspaper' : 'defeat')
    } else {
      bgm.playPhase(run.phase)
    }
  }, [run.phase, run.playerWon])

  useEffect(() => {
    const handleFirstInteraction = () => {
      bgm.unlock()
      window.removeEventListener('pointerdown', handleFirstInteraction)
      window.removeEventListener('keydown', handleFirstInteraction)
    }
    window.addEventListener('pointerdown', handleFirstInteraction)
    window.addEventListener('keydown', handleFirstInteraction)
    return () => {
      window.removeEventListener('pointerdown', handleFirstInteraction)
      window.removeEventListener('keydown', handleFirstInteraction)
    }
  }, [])

  const startRound = useCallback(async (r: number, names: string[]) => {
    dispatch({ type: 'LOADING', text: 'AI가 새로운 무법자를 쓰는 중…' })
    const { opponent: opp, usedAi } = await generateOpponent(r, names)
    dispatch({ type: 'ROUND_READY', opponent: opp, usedAi })
  }, [])

  function handleStart(customName?: string) {
    dispatch({ type: 'START_RUN', playerName: customName })
    void startRound(1, [])
  }

  async function finishEncounter(
    won: boolean,
    isPeace: boolean,
    m: DuelMods,
    outcome: DuelOutcome | null,
  ) {
    const current = runRef.current
    if (!current.opponent) return

    const next = applyEncounter(current, {
      won,
      isPeace,
      outcome,
      opponent: current.opponent,
    })
    dispatch({ type: 'COMMIT', state: next })

    const { article: paper, usedAi } = await generateNewspaper({
      opponent: current.opponent,
      playerWon: won,
      peace: isPeace,
      mood: m.mood,
      round: current.round,
      reactionMs: outcome?.reactionMs ?? null,
      headshot: outcome?.headshot ?? false,
      detail: outcome?.detail,
      playerName: current.playerName,
      streak: next.streak,
      fameTitle: getFameInfo(next.streak).title,
      bossScore: outcome?.bossScore,
    })
    dispatch({ type: 'NEWSPAPER_READY', article: paper, usedAi })
  }

  function handleStandoffDone(nextMods: DuelMods, usedAi: boolean) {
    dispatch({ type: 'STANDOFF_DONE', mods: nextMods, usedAi })
    if (nextMods.peaceEnding && runRef.current.opponent) {
      void finishEncounter(true, true, nextMods, null)
    }
  }

  function finishRun(victory: boolean) {
    const s = runRef.current
    const { career, run: recorded } = recordRun({
      victory,
      wins: s.wins,
      peaces: s.peaces,
      bounty: s.bounty,
      bestReactionMs: s.bestReactionMs,
      bestStreak: s.bestStreak,
      roundsReached: s.round,
      perks: s.perks,
    })
    dispatch({ type: 'END_RUN', career, run: recorded, victory })
  }

  function handleDuelResult(outcome: DuelOutcome) {
    void finishEncounter(outcome.won, false, runRef.current.mods, outcome)
  }

  function handlePickPerk(id: PerkId) {
    dispatch({ type: 'PICK_PERK', id })
  }

  function handleBuyConsumable(id: ConsumableId, cost: number) {
    dispatch({ type: 'BUY_CONSUMABLE', id, cost })
  }

  function handleBuyPerk(id: PerkId, cost: number) {
    dispatch({ type: 'BUY_PERK', id, cost })
  }

  function handleSpendBounty(amount: number): boolean {
    if (runRef.current.bounty < amount) return false
    dispatch({ type: 'SPEND_BOUNTY', amount })
    return true
  }

  function handleNewspaperNext() {
    const s = runRef.current
    if (!s.playerWon && !s.peace) {
      finishRun(false)
      return
    }
    if (s.round >= TOTAL_ROUNDS) {
      finishRun(true)
      return
    }
    dispatch({ type: 'SET_PHASE', phase: 'store' })
  }

  function handleStoreNext() {
    const s = runRef.current
    dispatch({ type: 'ADVANCE_ROUND' })
    void startRound(s.round + 1, s.prevNames)
  }

  const usedAiAny = run.aiFlags.opponent || run.aiFlags.chat || run.aiFlags.paper
  const aiLive = usedAiAny || aiReachable === true
  const aiStatus =
    aiReachable === null ? '… AI 확인 중' : aiLive ? '● LIVE AI' : '○ OFFLINE FALLBACK'
  const inRun =
    run.phase !== 'title' &&
    run.phase !== 'cutscene' &&
    run.phase !== 'victory' &&
    run.phase !== 'gameover'

  return (
    <div className="app">
      <Sandstorm intensity={run.phase === 'duel' ? 'light' : 'medium'} />
      {run.phase === 'title' && <TitleScreen onStart={handleStart} />}

      {run.phase === 'loading' && (
        <div className="screen loading-screen">
          <div className="spinner" />
          <p>{run.loadingText}</p>
          {run.lastOutcome && (
            <div className="loading-summary-chip">
              <span>
                {run.lastOutcome.won
                  ? '🎯 상대 제압'
                  : run.lastOutcome.foul
                    ? '⚠️ 반칙'
                    : '💀 결투 패배'}
              </span>
              {run.lastOutcome.reactionMs != null && <span>⚡ {run.lastOutcome.reactionMs}ms</span>}
              {run.lastOutcome.headshot && <span>💥 헤드샷!</span>}
            </div>
          )}
          <small>서부 전신이 메시지를 나르는 중…</small>
        </div>
      )}

      {run.phase === 'wanted' && run.opponent && (
        <WantedPoster
          opponent={run.opponent}
          round={run.round}
          usedAi={run.aiFlags.opponent}
          onContinue={() => dispatch({ type: 'SET_PHASE', phase: 'standoff' })}
        />
      )}

      {run.phase === 'standoff' && run.opponent && (
        <Standoff
          opponent={run.opponent}
          round={run.round}
          perks={run.perks}
          activeBuffs={run.activeBuffs}
          playerName={run.playerName}
          streak={run.streak}
          onFinish={handleStandoffDone}
        />
      )}

      {run.phase === 'duel' && run.opponent && (
        <Duel
          opponent={run.opponent}
          mods={run.mods}
          round={run.round}
          perks={run.perks}
          activeBuffs={run.activeBuffs}
          streak={run.streak}
          playerName={run.playerName}
          onResult={handleDuelResult}
        />
      )}

      {run.phase === 'newspaper' && run.opponent && run.article && (
        <Newspaper
          article={run.article}
          opponent={run.opponent}
          playerWon={run.playerWon}
          peace={run.peace}
          usedAi={run.aiFlags.paper}
          round={run.round}
          reward={run.lastReward}
          outcome={run.lastOutcome}
          perkChoices={run.perkChoices}
          pickedPerk={run.pickedPerk}
          onPickPerk={handlePickPerk}
          onNext={handleNewspaperNext}
          isLast={run.round >= TOTAL_ROUNDS}
        />
      )}

      {run.phase === 'store' && (
        <Store
          round={run.round}
          bounty={run.bounty}
          perks={run.perks}
          activeBuffs={run.activeBuffs}
          onBuyConsumable={handleBuyConsumable}
          onBuyPerk={handleBuyPerk}
          onSpendBounty={handleSpendBounty}
          onNext={handleStoreNext}
        />
      )}

      {run.phase === 'cutscene' && (
        <VictoryCutscene
          playerName={run.playerName}
          onComplete={() => dispatch({ type: 'SET_PHASE', phase: 'victory' })}
        />
      )}

      {(run.phase === 'victory' || run.phase === 'gameover') && run.endingCareer && run.endingRun && (
        <Ending
          wins={run.wins}
          peaces={run.peaces}
          bounty={run.bounty}
          perks={run.perks}
          victory={run.phase === 'victory'}
          career={run.endingCareer}
          lastRun={run.endingRun}
          playerName={run.playerName}
          onRestart={handleStart}
          onReplayCutscene={() => dispatch({ type: 'SET_PHASE', phase: 'cutscene' })}
        />
      )}

      <footer className="chrome">
        <div className="chrome-left">
          <span>AI GUNSLINGER</span>
          <div className="chrome-bgm-ctrl">
            <button
              className="chrome-bgm-btn"
              title={bgmMuted ? '배경음 켜기' : '배경음 끄기'}
              onClick={() => {
                bgm.unlock()
                sfx.click()
                bgm.toggleMute()
              }}
            >
              {bgmMuted ? '🔇 BGM' : '🔊 BGM'}
            </button>
            <input
              type="range"
              className="chrome-bgm-slider"
              min="0"
              max="1"
              step="0.05"
              value={bgmMuted ? 0 : bgmVolume}
              title={`BGM 볼륨: ${Math.round(bgmVolume * 100)}%`}
              onChange={(e) => {
                bgm.unlock()
                const next = parseFloat(e.target.value)
                bgm.setVolume(next)
                if (bgmMuted && next > 0) {
                  bgm.setMuted(false)
                }
              }}
            />
            <span className="chrome-bgm-vol">
              {bgmMuted ? 'OFF' : `${Math.round(bgmVolume * 100)}%`}
            </span>
          </div>
        </div>
        {inRun && (
          <span className="chrome-run">
            R{run.round}/{TOTAL_ROUNDS} · 현상금 ${run.bounty.toLocaleString()}
            {run.streak > 0 && (
              <span style={{ color: getFameInfo(run.streak).color, marginLeft: 6 }}>
                · {getFameInfo(run.streak).badge} ({run.streak}연승)
              </span>
            )}
          </span>
        )}
        <span>{aiStatus}</span>
      </footer>
    </div>
  )
}
