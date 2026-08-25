import { useCallback, useEffect, useRef, useState } from 'react'
import { checkAiHealth, generateNewspaper, generateOpponent } from './api/client'
import { getFameInfo } from './data/fame'
import { rollPerkChoices } from './data/perks'
import { recordRun } from './data/records'
import { FALLBACK_OPPONENTS } from './data/fallback'
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
import type {
  ActiveBuffs,
  CareerStats,
  ConsumableId,
  DuelMods,
  DuelOutcome,
  GamePhase,
  NewspaperArticle,
  Opponent,
  PerkId,
  RunRecord,
} from './types'
import './App.css'

const TOTAL_ROUNDS = 9

const EMPTY_MODS: DuelMods = {
  mood: 'calm',
  reactionDeltaMs: 0,
  accuracyDelta: 0,
  peaceEnding: false,
}

function rewardFor(
  opponent: Opponent,
  outcome: DuelOutcome | null,
  isPeace: boolean,
  streak: number,
  perks: PerkId[],
) {
  const spurMult = perks.includes('golden_spur') ? 1.3 : 1
  if (isPeace) return Math.round(opponent.bounty * 0.6 * spurMult)
  const headMult = outcome?.headshot ? (perks.includes('silver') ? 2 : 1.5) : 1
  const streakMult = 1 + Math.min(streak, 5) * 0.1
  return Math.round(opponent.bounty * headMult * streakMult * spurMult)
}

export default function App() {
  const [playerName, setPlayerName] = useState<string>(() => {
    try {
      return localStorage.getItem('ai-gunslinger.player-name') || '이름 없는 총잡이'
    } catch {
      return '이름 없는 총잡이'
    }
  })

  const previewParam = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('preview') ||
      (window.location.search.includes('duel9')
        ? 'duel9'
        : window.location.search.includes('cutscene')
          ? 'cutscene'
          : window.location.search.includes('ending')
            ? 'victory'
            : null)
    : null

  const roundParam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('round') : null
  const parsedRound = roundParam ? parseInt(roundParam, 10) : null
  const isRoundPreview = parsedRound != null && !isNaN(parsedRound) && parsedRound >= 1 && parsedRound <= 9

  const isPreviewDuel9 = previewParam === 'duel9' || previewParam === 'boss'
  const isPreviewCutscene = previewParam === 'cutscene'
  const isPreviewVictory = previewParam === 'victory'
  const isPreviewDefeat = previewParam === 'defeat'
  const isPreview = isRoundPreview || isPreviewDuel9 || isPreviewCutscene || isPreviewVictory || isPreviewDefeat

  const [phase, setPhase] = useState<GamePhase>(
    isPreview
      ? isRoundPreview || isPreviewDuel9
        ? 'duel'
        : isPreviewCutscene
          ? 'cutscene'
          : isPreviewVictory
            ? 'victory'
            : 'gameover'
      : 'title',
  )
  const [round, setRound] = useState(isRoundPreview ? parsedRound : isPreview ? 9 : 1)
  const [opponent, setOpponent] = useState<Opponent | null>(() => {
    if (isRoundPreview) {
      return FALLBACK_OPPONENTS[parsedRound - 1] ?? FALLBACK_OPPONENTS[0]
    }
    if (isPreviewDuel9) {
      return {
        id: 'boss-9',
        name: '엘 카란자',
        alias: '그림자 없는 마지막 무법자',
        bounty: 50000,
        crime: '국경 지대 연쇄 살인 및 현상금 사냥꾼 전멸',
        appearance: '칠흑 같은 가죽 코트와 붉은 눈빛의 전설적인 총잡이',
        baseReactionMs: 270,
        baseAccuracy: 0.88,
        tell: '오른쪽 검지 손가락을 미세하게 튕김',
        personality: '냉혹하고 침착함',
        taunt: '내 총구를 보고도 살아남은 자는 없다.',
      }
    }
    return null
  })
  const [mods, setMods] = useState<DuelMods>(EMPTY_MODS)
  const [article, setArticle] = useState<NewspaperArticle | null>(null)
  const [playerWon, setPlayerWon] = useState(isPreviewVictory || isPreviewCutscene)
  const [peace, setPeace] = useState(false)
  const [wins, setWins] = useState(isPreview ? (isPreviewDefeat ? 4 : 8) : 0)
  const [peaces, setPeaces] = useState(isPreview ? 1 : 0)
  const [prevNames, setPrevNames] = useState<string[]>([])
  const [aiFlags, setAiFlags] = useState({ opponent: false, chat: false, paper: false })
  const [aiReachable, setAiReachable] = useState<boolean | null>(null)
  const [loadingText, setLoadingText] = useState('수배서를 인쇄하는 중…')

  const [perks, setPerks] = useState<PerkId[]>(isPreview ? ['fast', 'keen', 'silver', 'golden_spur'] : [])
  const [perkChoices, setPerkChoices] = useState<PerkId[]>([])
  const [pickedPerk, setPickedPerk] = useState<PerkId | null>(null)
  const [activeBuffs, setActiveBuffs] = useState<ActiveBuffs>({})
  const [streak, setStreak] = useState(isPreview ? (isPreviewDefeat ? 0 : 9) : 0)
  const [bounty, setBounty] = useState(isPreview ? 248500 : 0)
  const [lastReward, setLastReward] = useState(0)
  const [lastOutcome, setLastOutcome] = useState<DuelOutcome | null>(null)
  const [endingCareer, setEndingCareer] = useState<CareerStats | null>(() => {
    if (!isPreview) return null
    return {
      runs: 5,
      victories: 2,
      defeats: 3,
      totalWins: 28,
      totalPeaces: 4,
      bestBounty: 248500,
      bestReactionMs: 214,
      bestStreak: 9,
      recent: [],
    }
  })
  const [endingRun, setEndingRun] = useState<RunRecord | null>(() => {
    if (!isPreview) return null
    return {
      id: 'preview-run',
      at: Date.now(),
      victory: !isPreviewDefeat,
      wins: isPreviewDefeat ? 4 : 8,
      peaces: 1,
      bounty: 248500,
      bestReactionMs: 214,
      bestStreak: isPreviewDefeat ? 4 : 9,
      roundsReached: isPreviewDefeat ? 5 : 9,
      perks: ['fast', 'keen', 'silver', 'golden_spur'],
    }
  })
  const [bgmMuted, setBgmMuted] = useState(() => bgm.isMuted())
  const [bgmVolume, setBgmVolumeState] = useState(() => bgm.getVolume())

  const perksRef = useRef<PerkId[]>([])
  const streakRef = useRef(0)
  const winsRef = useRef(0)
  const peacesRef = useRef(0)
  const bountyRef = useRef(0)
  const bestReactionRef = useRef<number | null>(null)
  const bestStreakRef = useRef(0)
  const roundRef = useRef(1)

  perksRef.current = perks
  streakRef.current = streak
  winsRef.current = wins
  peacesRef.current = peaces
  bountyRef.current = bounty
  roundRef.current = round

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
    if (phase === 'newspaper') {
      bgm.play(playerWon ? 'newspaper' : 'defeat')
    } else {
      bgm.playPhase(phase)
    }
  }, [phase, playerWon])

  // Unlock BGM on first user interaction anywhere
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
    setPhase('loading')
    setLoadingText('AI가 새로운 무법자를 쓰는 중…')
    const { opponent: opp, usedAi } = await generateOpponent(r, names)
    setOpponent(opp)
    setPrevNames((n) => [...n, opp.name, opp.alias])
    setAiFlags((f) => ({ ...f, opponent: usedAi }))
    setMods(EMPTY_MODS)
    setPerkChoices([])
    setPickedPerk(null)
    setLastOutcome(null)
    setPhase('wanted')
  }, [])

  function handleStart(customName?: string) {
    if (customName && customName.trim()) {
      setPlayerName(customName.trim())
    }
    setRound(1)
    roundRef.current = 1
    setWins(0)
    winsRef.current = 0
    setPeaces(0)
    peacesRef.current = 0
    setPrevNames([])
    setPerks([])
    perksRef.current = []
    setActiveBuffs({})
    setStreak(0)
    streakRef.current = 0
    setBounty(0)
    bountyRef.current = 0
    bestReactionRef.current = null
    bestStreakRef.current = 0
    setEndingCareer(null)
    setEndingRun(null)
    setAiFlags({ opponent: false, chat: false, paper: false })
    void startRound(1, [])
  }

  function handleStandoffDone(nextMods: DuelMods, usedAi: boolean) {
    setMods(nextMods)
    setAiFlags((f) => ({ ...f, chat: usedAi }))
    if (nextMods.peaceEnding && opponent) {
      void finishEncounter(true, true, nextMods, null)
      return
    }
    setPhase('duel')
  }

  function finishRun(victory: boolean) {
    const { career, run } = recordRun({
      victory,
      wins: winsRef.current,
      peaces: peacesRef.current,
      bounty: bountyRef.current,
      bestReactionMs: bestReactionRef.current,
      bestStreak: bestStreakRef.current,
      roundsReached: roundRef.current,
      perks: perksRef.current,
    })
    setEndingCareer(career)
    setEndingRun(run)
    setPhase(victory ? 'cutscene' : 'gameover')
  }

  async function finishEncounter(
    won: boolean,
    isPeace: boolean,
    m: DuelMods,
    outcome: DuelOutcome | null,
  ) {
    if (!opponent) return

    const nextStreak = won ? streakRef.current + 1 : 0
    setStreak(nextStreak)
    streakRef.current = nextStreak
    if (nextStreak > bestStreakRef.current) bestStreakRef.current = nextStreak

    if (outcome?.reactionMs != null && outcome.reactionMs > 0) {
      const prev = bestReactionRef.current
      if (prev == null || outcome.reactionMs < prev) {
        bestReactionRef.current = outcome.reactionMs
      }
    }

    setPlayerWon(won)
    setPeace(isPeace)
    setLastOutcome(outcome)
    if (isPeace) {
      peacesRef.current += 1
      setPeaces(peacesRef.current)
    } else if (won) {
      winsRef.current += 1
      setWins(winsRef.current)
    }

    const reward = won
      ? rewardFor(opponent, outcome, isPeace, nextStreak, perksRef.current)
      : 0
    setLastReward(reward)
    if (reward > 0) {
      bountyRef.current += reward
      setBounty(bountyRef.current)
    }

    const canPick = won && round < TOTAL_ROUNDS
    setPerkChoices(canPick ? rollPerkChoices(perksRef.current, 3) : [])
    setPickedPerk(null)

    // 소모품 버프는 해당 라운드 결투 종료 시 소비됨
    setActiveBuffs({})

    setPhase('loading')
    setLoadingText('신문 조판 중…')
    const fameInfo = getFameInfo(nextStreak)
    const { article: paper, usedAi } = await generateNewspaper({
      opponent,
      playerWon: won,
      peace: isPeace,
      mood: m.mood,
      round,
      reactionMs: outcome?.reactionMs ?? null,
      headshot: outcome?.headshot ?? false,
      detail: outcome?.detail,
      playerName,
      streak: nextStreak,
      fameTitle: fameInfo.title,
      bossScore: outcome?.bossScore,
    })
    setArticle(paper)
    setAiFlags((f) => ({ ...f, paper: usedAi }))
    setPhase('newspaper')
  }

  function handleDuelResult(outcome: DuelOutcome) {
    void finishEncounter(outcome.won, false, mods, outcome)
  }

  function handlePickPerk(id: PerkId) {
    if (pickedPerk) return
    setPickedPerk(id)
    const next = [...perksRef.current, id]
    setPerks(next)
    perksRef.current = next
  }

  function handleBuyConsumable(id: ConsumableId, cost: number) {
    if (bountyRef.current < cost) return
    const nextBounty = bountyRef.current - cost
    setBounty(nextBounty)
    bountyRef.current = nextBounty
    setActiveBuffs((prev) => ({ ...prev, [id]: true }))
  }

  function handleBuyPerk(id: PerkId, cost: number) {
    if (bountyRef.current < cost || perksRef.current.includes(id)) return
    const nextBounty = bountyRef.current - cost
    setBounty(nextBounty)
    bountyRef.current = nextBounty
    const nextPerks = [...perksRef.current, id]
    setPerks(nextPerks)
    perksRef.current = nextPerks
  }

  function handleSpendBounty(amount: number): boolean {
    if (bountyRef.current < amount) return false
    const nextBounty = bountyRef.current - amount
    setBounty(nextBounty)
    bountyRef.current = nextBounty
    return true
  }

  function handleNewspaperNext() {
    if (!playerWon && !peace) {
      finishRun(false)
      return
    }
    if (round >= TOTAL_ROUNDS) {
      finishRun(true)
      return
    }
    // 결투 승리 후 더스트 타운 잡화점으로 이동
    setPhase('store')
  }

  function handleStoreNext() {
    const next = round + 1
    setRound(next)
    roundRef.current = next
    void startRound(next, prevNames)
  }

  const usedAiAny = aiFlags.opponent || aiFlags.chat || aiFlags.paper
  const aiLive = usedAiAny || aiReachable === true
  const aiStatus =
    aiReachable === null ? '… AI 확인 중' : aiLive ? '● LIVE AI' : '○ OFFLINE FALLBACK'
  const inRun = phase !== 'title' && phase !== 'cutscene' && phase !== 'victory' && phase !== 'gameover'

  return (
    <div className="app">
      <Sandstorm intensity={phase === 'duel' ? 'light' : 'medium'} />
      {phase === 'title' && <TitleScreen onStart={handleStart} />}

      {phase === 'loading' && (
        <div className="screen loading-screen">
          <div className="spinner" />
          <p>{loadingText}</p>
          <small>서부 전신이 메시지를 나르는 중…</small>
        </div>
      )}

      {phase === 'wanted' && opponent && (
        <WantedPoster
          opponent={opponent}
          round={round}
          usedAi={aiFlags.opponent}
          onContinue={() => setPhase('standoff')}
        />
      )}

      {phase === 'standoff' && opponent && (
        <Standoff
          opponent={opponent}
          round={round}
          perks={perks}
          activeBuffs={activeBuffs}
          playerName={playerName}
          streak={streak}
          onFinish={handleStandoffDone}
        />
      )}

      {phase === 'duel' && opponent && (
        <Duel
          opponent={opponent}
          mods={mods}
          round={round}
          perks={perks}
          activeBuffs={activeBuffs}
          streak={streak}
          playerName={playerName}
          onResult={handleDuelResult}
        />
      )}

      {phase === 'newspaper' && opponent && article && (
        <Newspaper
          article={article}
          opponent={opponent}
          playerWon={playerWon}
          peace={peace}
          usedAi={aiFlags.paper}
          round={round}
          reward={lastReward}
          outcome={lastOutcome}
          perkChoices={perkChoices}
          pickedPerk={pickedPerk}
          onPickPerk={handlePickPerk}
          onNext={handleNewspaperNext}
          isLast={round >= TOTAL_ROUNDS}
        />
      )}

      {phase === 'store' && (
        <Store
          round={round}
          bounty={bounty}
          perks={perks}
          activeBuffs={activeBuffs}
          onBuyConsumable={handleBuyConsumable}
          onBuyPerk={handleBuyPerk}
          onSpendBounty={handleSpendBounty}
          onNext={handleStoreNext}
        />
      )}

      {phase === 'cutscene' && (
        <VictoryCutscene
          playerName={playerName}
          streak={streak}
          bounty={bounty}
          perks={perks}
          onComplete={() => setPhase('victory')}
        />
      )}

      {(phase === 'victory' || phase === 'gameover') && endingCareer && endingRun && (
        <Ending
          wins={wins}
          peaces={peaces}
          bounty={bounty}
          perks={perks}
          victory={phase === 'victory'}
          career={endingCareer}
          lastRun={endingRun}
          playerName={playerName}
          onRestart={handleStart}
          onReplayCutscene={() => setPhase('cutscene')}
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
            R{round}/{TOTAL_ROUNDS} · 현상금 ${bounty.toLocaleString()}
            {streak > 0 && (
              <span style={{ color: getFameInfo(streak).color, marginLeft: 6 }}>
                · {getFameInfo(streak).badge} ({streak}연승)
              </span>
            )}
          </span>
        )}
        <span>{aiStatus}</span>
      </footer>
    </div>
  )
}
