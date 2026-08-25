import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { bgm } from '../audio/bgm'
import { sfx } from '../audio/sfx'
import { CANVAS_LABEL_FONT } from '../fonts'
import { getFameInfo } from '../data/fame'
import { perkById } from '../data/perks'
import { PerkIcon } from './PerkIcon'
import { geometryOf, getBackdrop, getThemeInfo } from '../canvas/backdrop'
import { createDuelFx, type DuelFx } from '../gl/duelFx'
import {
  HOLSTER_HALF_W,
  HOLSTER_REACH,
  HOLSTER_TOP_PAD,
  drawGrain,
  drawGunslinger,
  drawHolster,
  drawTumbleweed,
  drawVultures,
} from '../canvas/actors'
import type { DrawGrade, DuelMods, DuelOutcome, Opponent, PerkId } from '../types'

type Phase = 'idle' | 'holding' | 'draw' | 'result'

interface Props {
  opponent: Opponent
  mods: DuelMods
  round: number
  perks: PerkId[]
  activeBuffs?: { smoke?: boolean; powder?: boolean; bible?: boolean }
  streak: number
  playerName?: string
  onResult: (outcome: DuelOutcome) => void
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  decay: number
  size: number
}

interface Tracer {
  x1: number
  y1: number
  x2: number
  y2: number
  life: number
  color: string
  width: number
}

interface ShellParticle {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  vRot: number
  life: number
  decay: number
  groundY: number
}

interface FloatText {
  x: number
  y: number
  text: string
  color: string
  life: number
  size: number
}

interface ShockwaveRing {
  x: number
  y: number
  r: number
  maxR: number
  alpha: number
  color: string
}

const HOLD_STEPS = [620, 1240, 1860]

function gradeOf(ms: number): DrawGrade {
  if (ms <= 220) return 'S'
  if (ms <= 320) return 'A'
  if (ms <= 430) return 'B'
  return 'C'
}

const GRADE_LABEL: Record<DrawGrade, string> = {
  S: '전광석화',
  A: '번개같이',
  B: '무난하게',
  C: '아슬아슬',
  '-': '',
}

export function Duel({
  opponent,
  mods,
  round,
  perks,
  activeBuffs = {},
  streak,
  playerName = 'YOU',
  onResult,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fxCanvasRef = useRef<HTMLCanvasElement>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [message, setMessage] = useState('홀스터를 누른 채 버텨라')
  const [countdown, setCountdown] = useState<number | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [grade, setGrade] = useState<DrawGrade>('-')
  const [flash, setFlash] = useState<'none' | 'draw' | 'win' | 'lose'>('none')

  // 9라운드 최종 보스 3판 2선승제 (BO3) 상태
  const isFinalBoss = round === 9
  const [bossSet, setBossSet] = useState(1)
  const [playerScore, setPlayerScore] = useState(0)
  const [enemyScore, setEnemyScore] = useState(0)
  const [interSetBanner, setInterSetBanner] = useState<{ title: string; subtitle: string } | null>(null)

  const isFinalBossRef = useRef(isFinalBoss)
  useEffect(() => {
    isFinalBossRef.current = isFinalBoss
  }, [isFinalBoss])
  const bossSetRef = useRef(1)
  const playerScoreRef = useRef(0)
  const enemyScoreRef = useRef(0)
  const setHistoryRef = useRef<
    Array<{
      setNum: number
      winner: 'player' | 'enemy'
      reactionMs: number | null
      headshot: boolean
    }>
  >([])

  const has = useCallback((id: PerkId) => perks.includes(id), [perks])
  const fame = useMemo(() => getFameInfo(streak), [streak])
  const themeInfo = useMemo(() => getThemeInfo(round), [round])

  const tuning = useMemo(() => {
    // 1. 라운드 난이도 & 판정 너그러움: 초반(1~3R)은 +28%, 중반(4~6R)은 +15%, 후반(7~9R)은 +5%
    const roundScale = round <= 3 ? 1.28 : round <= 6 ? 1.15 : 1.05

    // 2. 대치(심리전) 결과: 공포/위축/경계 상태면 자세가 무너져 +18%, 평정이면 정자세 -5%
    const moodScale =
      mods.mood === 'scared' || mods.mood === 'intimidated' || mods.mood === 'suspicious'
        ? 1.18
        : mods.mood === 'angered'
          ? 1.10
          : mods.mood === 'calm'
            ? 0.95
            : 1.0

    // 3. 사막 거리감 & 바람에 따른 고유 편차 (±5% 미세 편차)
    const envJitter = (((opponent.name.length * 13 + round * 37) % 11) - 5) * 0.01

    // 4. 전리품 및 소모품(정밀화약) 보너스
    const perkHitScale = perks.includes('keen') ? 1.35 : 1.0
    const perkHeadScale = (perks.includes('silver') ? 1.25 : 1.0) * (activeBuffs.powder ? 1.45 : 1.0)

    // 최종 결투 히트박스 스케일
    const totalHitScale = roundScale * moodScale * (1 + envJitter) * perkHitScale

    // 결정론적 반응속도 지터
    const jitter = (((opponent.name.length * 17 + round * 23) % 25) - 12)

    // 연막탄 소모품: 상대 명중률 20% 감소
    const smokeDebuff = activeBuffs.smoke ? 0.2 : 0

    return {
      warnings: 1 + (perks.includes('steady') ? 1 : 0),
      hitScale: totalHitScale,
      headScale: perkHeadScale,
      fastGrace: perks.includes('fast') ? 65 : 0,
      enemyReaction: Math.max(
        190,
        opponent.baseReactionMs +
          mods.reactionDeltaMs +
          jitter +
          (perks.includes('charm') ? 40 : 0),
      ),
      accuracy: Math.min(0.99, Math.max(0.12, opponent.baseAccuracy + mods.accuracyDelta - smokeDebuff)),
      hitBonusPercent: Math.round((totalHitScale - 1) * 100),
    }
  }, [
    opponent.name,
    opponent.baseReactionMs,
    opponent.baseAccuracy,
    mods.reactionDeltaMs,
    mods.accuracyDelta,
    mods.mood,
    perks,
    activeBuffs.powder,
    activeBuffs.smoke,
    round,
  ])

  const [warningsLeft, setWarningsLeft] = useState(() => tuning.warnings)

  const phaseRef = useRef<Phase>('idle')
  const countdownRef = useRef<number | null>(null)
  const onResultRef = useRef(onResult)
  const drawAtRef = useRef(0)
  const enemyShotAtRef = useRef(0)
  const playerShotAtRef = useRef<number | null>(null)
  const pointerRef = useRef({ x: 0, y: 0, down: false, inHolster: false })
  const rafRef = useRef(0)
  const timersRef = useRef<number[]>([])

  useEffect(() => {
    countdownRef.current = countdown
  }, [countdown])

  useEffect(() => {
    onResultRef.current = onResult
  }, [onResult])

  const hasRef = useRef(has)
  useEffect(() => {
    hasRef.current = has
  }, [has])

  const playerNameRef = useRef(playerName)
  useEffect(() => {
    playerNameRef.current = playerName
  }, [playerName])

  const fameRef = useRef(fame)
  useEffect(() => {
    fameRef.current = fame
  }, [fame])

  const streakRef = useRef(streak)
  useEffect(() => {
    streakRef.current = streak
  }, [streak])

  const activeBuffsRef = useRef(activeBuffs)
  useEffect(() => {
    activeBuffsRef.current = activeBuffs
  }, [activeBuffs])

  const resolvedRef = useRef(false)
  const dustRef = useRef<Particle[]>([])
  const smokeRef = useRef<Particle[]>([])
  const tracersRef = useRef<Tracer[]>([])
  const shellsRef = useRef<ShellParticle[]>([])
  const floatTextsRef = useRef<FloatText[]>([])
  const shockwavesRef = useRef<ShockwaveRing[]>([])
  const secondChanceUsedRef = useRef(false)
  const bibleUsedRef = useRef(false)
  const shakeRef = useRef(0)
  const resultFlashRef = useRef(0)
  const zoomRef = useRef(0)
  const winnerRef = useRef<'player' | 'enemy' | 'none'>('none')
  const fallStartRef = useRef(0)
  const warningsRef = useRef(0)
  const enemyAccBonusRef = useRef(0)
  const feintUntilRef = useRef(0)
  const tellFlashRef = useRef(0)
  const hitMarkRef = useRef<{ x: number; y: number; head: boolean } | null>(null)

  useEffect(() => {
    warningsRef.current = tuning.warnings
  }, [tuning.warnings])

  const setPhaseSafe = useCallback((p: Phase) => {
    phaseRef.current = p
    setPhase(p)
  }, [])

  useEffect(() => {
    sfx.unlock()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let dpr = 1

    const clearTimers = () => {
      timersRef.current.forEach((id) => clearTimeout(id))
      timersRef.current = []
    }
    const later = (fn: () => void, ms: number) => {
      timersRef.current.push(window.setTimeout(fn, ms))
    }

    let cachedL = {
      w: 800,
      h: 540,
      horizon: 297,
      s: 1,
      hs: 1,
      playerX: 144,
      enemyX: 656,
      bodyY: 329,
      headY: 299,
      bodyR: 48,
      headR: 19,
      holsterX: 400,
      holsterY: 410,
    }

    const updateLayout = () => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      const g = geometryOf(w, h)
      const s = Math.max(0.7, Math.min(1.05, h / 540))
      const bodyY = g.horizon + h * 0.06
      const bar = h * 0.042
      const room = h - bar - (bodyY + 78 * s) - 10
      const hs = Math.max(0.6, Math.min(s * 1.5, room / 98))
      cachedL = {
        w,
        h,
        horizon: g.horizon,
        s,
        hs,
        playerX: w * 0.18,
        enemyX: w * 0.82,
        bodyY,
        headY: bodyY - 30 * s,
        bodyR: 66 * s * tuning.hitScale,
        headR: 26 * s * tuning.hitScale * tuning.headScale,
        holsterX: w * 0.5,
        holsterY: h - bar - 6 - 98 * hs,
      }
    }

    const resize = () => {
      const parent = canvas.parentElement
      // FX가 켜지면 씬을 매 프레임 텍스처로 올린다. dpr 2는 대역폭이 과해
      // 내장 GPU에서 프레임이 밀린다.
      dpr = Math.min(window.devicePixelRatio || 1, fx ? 1.5 : 2)
      const cssW = Math.min(920, parent?.clientWidth ?? 800)
      const cssH = Math.min(580, Math.max(420, Math.floor(cssW * 0.68)))
      canvas.style.width = `${cssW}px`
      canvas.style.height = `${cssH}px`
      canvas.width = Math.floor(cssW * dpr)
      canvas.height = Math.floor(cssH * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      updateLayout()
      fx?.resize(cssW, cssH)
    }

    const fx: DuelFx | null = fxCanvasRef.current
      ? createDuelFx(fxCanvasRef.current)
      : null
    if (fx && fxCanvasRef.current) fxCanvasRef.current.classList.add('on')

    resize()
    window.addEventListener('resize', resize)

    const layout = () => cachedL

    const holsterHit = (x: number, y: number) => {
      const L = cachedL
      return (
        x >= L.holsterX - HOLSTER_HALF_W * L.hs &&
        x <= L.holsterX + HOLSTER_HALF_W * L.hs &&
        y >= L.holsterY - HOLSTER_TOP_PAD * L.hs &&
        y <= L.holsterY + HOLSTER_REACH * L.hs
      )
    }

    const toLocal = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect()
      return {
        x: ((clientX - rect.left) / rect.width) * canvas.clientWidth,
        y: ((clientY - rect.top) / rect.height) * canvas.clientHeight,
      }
    }

    const spawnDust = (x: number, y: number, n: number) => {
      for (let i = 0; i < n; i++) {
        dustRef.current.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 5,
          vy: -Math.random() * 3.5 - 0.5,
          life: 1,
          decay: 0.03,
          size: 2 + Math.random() * 3.5,
        })
      }
    }

    const spawnSmoke = (x: number, y: number, dir: number) => {
      for (let i = 0; i < 14; i++) {
        smokeRef.current.push({
          x: x + Math.random() * 6,
          y: y + (Math.random() - 0.5) * 6,
          vx: dir * (0.5 + Math.random() * 1.6),
          vy: -0.35 - Math.random() * 0.7,
          life: 1,
          decay: 0.012 + Math.random() * 0.01,
          size: 4 + Math.random() * 9,
        })
      }
    }

    const spawnShell = (x: number, y: number, dir: number, groundY: number) => {
      shellsRef.current.push({
        x,
        y,
        vx: -dir * (2.4 + Math.random() * 2.2),
        vy: -4.5 - Math.random() * 3.5,
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.45,
        life: 1,
        decay: 0.003,
        groundY,
      })
    }

    const spawnShockwave = (x: number, y: number, maxR: number, color = '#ffd700') => {
      shockwavesRef.current.push({
        x,
        y,
        r: 6,
        maxR,
        alpha: 1,
        color,
      })
    }

    later(() => {
      sfx.gunLoad(0.7)
    }, 280)

    const effAccuracy = () => Math.min(0.99, tuning.accuracy + enemyAccBonusRef.current)

    const resolve = (outcome: DuelOutcome) => {
      if (resolvedRef.current) return
      resolvedRef.current = true
      clearTimers()
      setCountdown(null)
      setPhaseSafe('result')
      winnerRef.current = outcome.won ? 'player' : outcome.foul ? 'none' : 'enemy'
      fallStartRef.current = performance.now()
      resultFlashRef.current = 1
      shakeRef.current = outcome.headshot ? 22 : outcome.won ? 15 : 10
      setFlash(outcome.won ? 'win' : 'lose')
      setMessage(outcome.detail)
      setGrade(outcome.grade)

      const LF = layout()
      // 총알이 박힌 쪽으로 화면이 빨려 들어가게 초점을 옮긴다
      fx?.focusAt(
        outcome.won ? LF.enemyX : LF.playerX,
        LF.bodyY - 6 * LF.s,
        LF.w,
        LF.h,
      )
      fx?.kick(outcome.won ? 'win' : 'lose')

      if (!outcome.foul) {
        const shooterX = outcome.won ? LF.playerX : LF.enemyX
        const dir = outcome.won ? 1 : -1
        spawnSmoke(shooterX + dir * 56 * LF.s, LF.bodyY - 20 * LF.s, dir)
        spawnShell(shooterX, LF.bodyY - 15 * LF.s, dir, LF.bodyY + 60 * LF.s)
        bgm.duck(0.18, 1200)
        sfx.gunshot()
      }

      // 타격 FX & 플로팅 크리티컬 텍스트
      if (outcome.won) {
        if (outcome.headshot) {
          spawnShockwave(LF.enemyX, LF.headY, 120 * LF.s, '#ffd700')
          floatTextsRef.current.push({
            x: LF.enemyX,
            y: LF.headY - 26 * LF.s,
            text: '💥 CRITICAL HEADSHOT!',
            color: '#ffd700',
            life: 1,
            size: Math.round(20 * LF.s),
          })
        } else if (outcome.reactionMs != null && outcome.reactionMs <= 260) {
          spawnShockwave(LF.enemyX, LF.bodyY - 10 * LF.s, 75 * LF.s, '#4deeea')
          floatTextsRef.current.push({
            x: LF.playerX,
            y: LF.bodyY - 45 * LF.s,
            text: `⚡ FAST DRAW! ${outcome.reactionMs}ms`,
            color: '#4deeea',
            life: 1,
            size: Math.round(17 * LF.s),
          })
        }
      }

      if (bibleUsedRef.current) {
        floatTextsRef.current.push({
          x: LF.playerX,
          y: LF.bodyY - 30 * LF.s,
          text: '🛡️ BIBLE DEFLECT!',
          color: '#ffffff',
          life: 1,
          size: Math.round(18 * LF.s),
        })
      }

      later(() => {
        if (outcome.headshot) sfx.headshot()
        else if (outcome.won) sfx.win()
        else sfx.lose()
      }, 130)

      // 총을 맞고 쓰러지면서 바닥에 떨어지는 리볼버 소리
      if (!outcome.foul) {
        later(() => {
          sfx.gunFall(0.75)
        }, 420)
      }

      // 9라운드 최종 보스 3판 2선승제 (BO3) 처리
      if (isFinalBossRef.current) {
        const setWinner = outcome.won ? 'player' : 'enemy'
        const nextPlayerScore = outcome.won ? playerScoreRef.current + 1 : playerScoreRef.current
        const nextEnemyScore = !outcome.won ? enemyScoreRef.current + 1 : enemyScoreRef.current

        playerScoreRef.current = nextPlayerScore
        enemyScoreRef.current = nextEnemyScore
        setPlayerScore(nextPlayerScore)
        setEnemyScore(nextEnemyScore)

        setHistoryRef.current.push({
          setNum: bossSetRef.current,
          winner: setWinner,
          reactionMs: outcome.reactionMs,
          headshot: outcome.headshot,
        })

        // 한쪽이 2승에 도달했을 때 최종 경기 종료
        if (nextPlayerScore >= 2 || nextEnemyScore >= 2) {
          const finalWon = nextPlayerScore >= 2
          const finalDetail = finalWon
            ? `3판 2선승 대결 승리! (${nextPlayerScore}:${nextEnemyScore}) 전설의 보스를 쓰러뜨렸다!`
            : `3판 2선승 대결 패배... (${nextPlayerScore}:${nextEnemyScore}) 마지막 사투에서 무릎 꿇다.`

          const finalOutcome: DuelOutcome = {
            ...outcome,
            won: finalWon,
            detail: finalDetail,
            bossScore: {
              playerWins: nextPlayerScore,
              enemyWins: nextEnemyScore,
              totalSets: bossSetRef.current,
              setHistory: [...setHistoryRef.current],
            },
          }

          later(() => onResultRef.current(finalOutcome), 2200)
          return
        }

        // 1:0 또는 1:1 상황 -> 다음 세트(Phase)로 전환
        const nextSet = bossSetRef.current + 1
        bossSetRef.current = nextSet
        setBossSet(nextSet)

        later(() => {
          const nextTitle =
            nextSet === 2
              ? outcome.won
                ? 'PHASE 2 · 분노한 사신의 각성'
                : 'PHASE 2 · 반격의 기회'
              : 'FINAL PHASE · 최후의 일격 (1:1 동점)'
          const nextSub =
            nextSet === 2
              ? outcome.won
                ? '보스가 붉은 기운을 뿜으며 자세를 고쳐잡습니다! (반응속도 & 페인트 증가)'
                : '아직 끝나지 않았다. 마음을 다잡고 방아쇠를 쥐어라!'
              : '마지막 한 발로 모든 운명이 결정된다!'

          setInterSetBanner({ title: nextTitle, subtitle: nextSub })
          sfx.feint()

          // 세트 상태 및 시각 효과 리셋
          resolvedRef.current = false
          playerShotAtRef.current = null
          winnerRef.current = 'none'
          fallStartRef.current = 0
          hitMarkRef.current = null
          secondChanceUsedRef.current = false
          bibleUsedRef.current = false
          warningsRef.current = tuning.warnings
          setWarningsLeft(tuning.warnings)
          tracersRef.current = []
          dustRef.current = []
          smokeRef.current = []
          setFlash('none')
          setGrade('-')

          later(() => {
            setInterSetBanner(null)
            setPhaseSafe('idle')
            setMessage('홀스터를 누른 채 버텨라')
            sfx.draw()
          }, 2400)
        }, 1900)
        return
      }

      later(() => onResultRef.current(outcome), 1850)
    }

    const breakGrip = (kind: 'release' | 'leave') => {
      if (phaseRef.current !== 'holding') return
      clearTimers()
      setCountdown(null)
      const feinted = performance.now() < feintUntilRef.current
      const reason = feinted
        ? '페인트에 걸렸다!'
        : kind === 'leave'
          ? '홀스터에서 손이 벗어났다!'
          : '성급하게 손을 뗐다!'

      if (warningsRef.current > 0) {
        warningsRef.current -= 1
        setWarningsLeft(warningsRef.current)
        enemyAccBonusRef.current += 0.04
        setWarning(`${reason} 상대가 침착해진다 · 남은 기회 ${warningsRef.current}`)
        setMessage('다시 홀스터를 잡아라')
        setPhaseSafe('idle')
        sfx.warn()
        shakeRef.current = 5
      } else {
        resolve({
          won: false,
          detail: `${reason} 반칙 패배.`,
          reactionMs: null,
          grade: '-',
          headshot: false,
          foul: true,
        })
      }
    }

    const fireDraw = () => {
      if (phaseRef.current !== 'holding') return
      setCountdown(null)
      drawAtRef.current = performance.now()

      const isBoss = isFinalBossRef.current
      const currentSet = bossSetRef.current
      const bossReactionBonus = isBoss
        ? currentSet === 2
          ? playerScoreRef.current > enemyScoreRef.current ? 25 : 10
          : currentSet === 3
            ? 45
            : 0
        : 0
      const enemyReactionTime = Math.max(160, tuning.enemyReaction - bossReactionBonus)
      enemyShotAtRef.current = drawAtRef.current + enemyReactionTime

      setPhaseSafe('draw')
      setFlash('draw')
      setMessage('쏴라!')
      sfx.draw()
      shakeRef.current = 8
      // 조준을 가리지 않도록 색수차만 짧게 튄다. 블러는 판정 후에만.
      fx?.focusAt(layout().w * 0.5, layout().h * 0.5, layout().w, layout().h)
      fx?.kick('draw')
      later(() => setFlash('none'), 200)
      later(() => {
        if (phaseRef.current === 'draw' && playerShotAtRef.current === null) {
          const enemyHits = Math.random() < effAccuracy()
          const L = layout()
          tracersRef.current.push({
            x1: L.enemyX - 24 * L.s,
            y1: L.bodyY - 4 * L.s,
            x2: enemyHits ? L.playerX : L.playerX - 40 * L.s,
            y2: L.bodyY,
            life: 1,
            color: '#ff6644',
            width: 3.2,
          })
          spawnDust(enemyHits ? L.playerX : L.enemyX, L.bodyY, 16)
          if (enemyHits && activeBuffsRef.current.bible && !bibleUsedRef.current) {
            bibleUsedRef.current = true
            sfx.shield()
            shakeRef.current = 10
            setMessage('포켓 성경이 총알을 튕겨냈다! 즉시 쏴라!')
            return
          }

          resolve({
            won: false,
            detail: enemyHits ? '너무 늦었다. 상대가 먼저 쏘았다.' : '망설이다 쏘지 못했다. 결투 패배.',
            reactionMs: null,
            grade: '-',
            headshot: false,
            foul: false,
          })
        }
      }, enemyReactionTime + 140)
    }

    const startGrip = () => {
      if (phaseRef.current !== 'idle' || resolvedRef.current) return
      setPhaseSafe('holding')
      setWarning(null)
      setMessage('버텨라 — 손을 떼지 마라')
      sfx.grip()
      setCountdown(3)
      sfx.tick(0)
      later(() => {
        setCountdown(2)
        sfx.tick(1)
      }, HOLD_STEPS[0])
      later(() => {
        setCountdown(1)
        sfx.tick(2)
      }, HOLD_STEPS[1])

      const extra = 300 + Math.random() * 1700
      const drawDelay = HOLD_STEPS[2] + extra

      later(() => {
        tellFlashRef.current = performance.now()
        sfx.tell()
      }, drawDelay - 170)

      const isBoss = isFinalBossRef.current
      const currentSet = bossSetRef.current
      const feintChance = isBoss
        ? currentSet === 1 ? 0.6 : currentSet === 2 ? 0.75 : 0.85
        : Math.min(0.7, 0.12 + round * 0.07)

      if ((round >= 2 || isBoss) && extra > 700 && Math.random() < feintChance) {
        const feintAt = HOLD_STEPS[2] + 120 + Math.random() * (extra - 620)
        later(() => {
          if (phaseRef.current !== 'holding') return
          feintUntilRef.current = performance.now() + 280
          shakeRef.current = 3
          sfx.feint()
        }, feintAt)
      }

      later(fireDraw, drawDelay)
    }

    const shoot = (x: number, y: number) => {
      if (resolvedRef.current) return
      if (phaseRef.current === 'holding') {
        breakGrip('release')
        return
      }
      if (phaseRef.current !== 'draw' || playerShotAtRef.current !== null) return

      const now = performance.now()
      const raw = now - drawAtRef.current
      const effective = raw - tuning.fastGrace
      const enemyMs = enemyShotAtRef.current - drawAtRef.current

      const L = layout()
      const dHead = Math.hypot(x - L.enemyX, y - L.headY)
      const dBody = Math.hypot(x - L.enemyX, y - (L.bodyY + 10 * L.s))
      const head = dHead <= L.headR
      // 캡슐 히트박스 판정: 캐릭터 주변 실루엣에 맞으면 너그럽게 몸통 명중 인정
      const inBodyCapsule =
        Math.abs(x - L.enemyX) <= L.bodyR * 1.12 &&
        y >= L.headY - L.headR &&
        y <= L.bodyY + 68 * L.s
      const body = !head && (dBody <= L.bodyR || inBodyCapsule)

      tracersRef.current.push({
        x1: L.playerX + 24 * L.s,
        y1: L.bodyY - 4 * L.s,
        x2: x,
        y2: y,
        life: 1,
        color: head ? '#ffe680' : '#ffb464',
        width: head ? 3.6 : 2.4,
      })

      spawnDust(x, y, 6)

      if (!head && !body) {
        if (hasRef.current('second_chance') && !secondChanceUsedRef.current && now < enemyShotAtRef.current) {
          secondChanceUsedRef.current = true
          setMessage('빗맞았다! 속사 리볼버 — 즉시 다시 쏴라!')
          sfx.grip()
          shakeRef.current = 4
          return
        }

        playerShotAtRef.current = now
        const enemyHits = Math.random() < effAccuracy()
        resolve({
          won: false,
          detail:
            now >= enemyShotAtRef.current && enemyHits
              ? '허공을 쐈다. 상대의 총알에 피격.'
              : '허공을 쐈다! 조준이 빗나갔다.',
          reactionMs: Math.round(raw),
          grade: '-',
          headshot: false,
          foul: false,
        })
        return
      }

      playerShotAtRef.current = now
      hitMarkRef.current = { x: L.enemyX, y: head ? L.headY : L.bodyY + 10 * L.s, head }

      if (effective < enemyMs) {
        spawnDust(L.enemyX, head ? L.headY : L.bodyY, head ? 24 : 16)
        resolve({
          won: true,
          detail: head ? `헤드샷! ${Math.round(raw)}ms` : `선제 사격! ${Math.round(raw)}ms`,
          reactionMs: Math.round(raw),
          grade: gradeOf(raw),
          headshot: head,
          foul: false,
        })
        return
      }

      const diffMs = effective - enemyMs
      // 근소한 차이(50ms 이내)로 늦었을 때 적 탄환이 빗나갈 확률 45% 보정 (극적인 역전 찬스)
      const isCloseCall = diffMs <= 50
      const enemyHitChance = isCloseCall ? effAccuracy() * 0.55 : effAccuracy()
      const enemyHits = Math.random() < enemyHitChance

      // 방탄 포켓 성경 버프 발동: 늦게 쐈더라도 성경이 총알을 막아내고 플레이어가 명중시킴
      if (enemyHits && activeBuffsRef.current.bible && !bibleUsedRef.current) {
        bibleUsedRef.current = true
        sfx.shield()
        shakeRef.current = 14
        spawnDust(L.playerX, L.bodyY, 18)
        spawnDust(L.enemyX, head ? L.headY : L.bodyY, 16)
        resolve({
          won: true,
          detail: `가슴의 포켓 성경이 총알을 튕겨냈다! 기적의 역전 명중! (${Math.round(raw)}ms)`,
          reactionMs: Math.round(raw),
          grade: gradeOf(raw),
          headshot: head,
          foul: false,
        })
        return
      }

      spawnDust(enemyHits ? L.playerX : L.enemyX, L.bodyY, 16)
      resolve({
        won: !enemyHits,
        detail: enemyHits
          ? `한발 늦었다! 상대의 총알에 피격. (상대 ${Math.round(enemyMs)}ms)`
          : `상대의 총알이 빗나갔다! 역전 명중 성공! (${Math.round(raw)}ms)`,
        reactionMs: Math.round(raw),
        grade: enemyHits ? '-' : gradeOf(raw),
        headshot: head && !enemyHits,
        foul: false,
      })
    }

    /* ------------------------------ 렌더 루프 ------------------------------ */

    const drawFrame = (t: number) => {
      const L = layout()
      const { w, h, s } = L
      const now = performance.now()

      const sx = (Math.random() - 0.5) * shakeRef.current
      const sy = (Math.random() - 0.5) * shakeRef.current
      shakeRef.current = Math.max(0, shakeRef.current * 0.9 - 0.1)

      const zoom = zoomRef.current
      zoomRef.current = Math.max(0, zoomRef.current * 0.95 - 0.002)

      ctx.clearRect(0, 0, w, h)
      ctx.save()
      ctx.translate(sx + (w / 2) * (1 - (1 + zoom)), sy + (h / 2) * (1 - (1 + zoom)))
      ctx.scale(1 + zoom, 1 + zoom)

      ctx.drawImage(getBackdrop(w, h, dpr, round), 0, 0, w, h)

      drawVultures(ctx, w, h, t)
      drawTumbleweed(ctx, w, h, L.horizon, t)

      const tellActive = now - tellFlashRef.current < 200
      const feintActive = now < feintUntilRef.current
      const holding = phaseRef.current === 'holding'
      const armed = phaseRef.current === 'draw' || phaseRef.current === 'result'

      const tension = holding ? Math.min(22, (now - drawAtRef.current) * 0.006) : 0
      const drawJitter = armed && !resolvedRef.current ? Math.sin(t / 25) * 1.5 : 0

      // 조준 원. DRAW 이후에만 보여 긴장을 유지한다
      if (phaseRef.current === 'draw') {
        const pulse = Math.sin(t / 60) * 3
        ctx.strokeStyle = 'rgba(255, 90, 60, 0.5)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(L.enemyX, L.bodyY + 10 * s, L.bodyR + pulse, 0, Math.PI * 2)
        ctx.stroke()

        ctx.strokeStyle = 'rgba(255, 228, 130, 0.95)'
        ctx.lineWidth = 2.5
        ctx.beginPath()
        ctx.arc(L.enemyX, L.headY, L.headR + pulse * 0.4, 0, Math.PI * 2)
        ctx.stroke()
        ctx.fillStyle = 'rgba(255, 228, 130, 0.95)'
        ctx.font = `700 ${Math.round(11 * s)}px ${CANVAS_LABEL_FONT}`
        ctx.textAlign = 'center'
        ctx.fillText('HEAD', L.enemyX, L.headY - L.headR - 8)
      }

      const fallOf = (side: 'player' | 'enemy') =>
        phaseRef.current === 'result' && winnerRef.current !== side && winnerRef.current !== 'none'
          ? Math.min(1, (now - fallStartRef.current) / 820)
          : 0

      drawGunslinger(ctx, {
        x: L.playerX + tension,
        y: L.bodyY + drawJitter,
        s,
        facingRight: true,
        armed,
        reaching: holding,
        fallT: fallOf('player'),
        coat: '#2a1a10',
        rim: 'rgba(255, 196, 120, 0.85)',
        t,
        twitch: 0,
      })

      drawGunslinger(ctx, {
        x: L.enemyX - tension,
        y: L.bodyY - drawJitter,
        s,
        facingRight: false,
        armed,
        reaching: false,
        fallT: fallOf('enemy'),
        coat: isFinalBoss && bossSetRef.current >= 2 ? '#350808' : '#2e1414',
        rim: isFinalBoss && bossSetRef.current >= 2 ? 'rgba(255, 65, 45, 0.98)' : 'rgba(255, 176, 110, 0.85)',
        t,
        twitch: tellActive ? 1.2 : feintActive ? 0.5 : 0,
      })

      if (tellActive && holding) {
        ctx.save()
        ctx.fillStyle = 'rgba(255, 230, 80, 0.98)'
        ctx.font = `900 ${Math.round(26 * s)}px ${CANVAS_LABEL_FONT}`
        ctx.textAlign = 'center'
        ctx.shadowColor = '#ffaa00'
        ctx.shadowBlur = 10
        ctx.fillText('!', L.enemyX + 36 * s, L.bodyY - 65 * s)
        ctx.font = `700 ${Math.round(11 * s)}px ${CANVAS_LABEL_FONT}`
        ctx.fillStyle = '#ffe080'
        ctx.shadowBlur = 4
        ctx.fillText('버릇 포착!', L.enemyX, L.bodyY - 84 * s)
        ctx.restore()
      }

      drawNameplate(
        ctx,
        streakRef.current >= 2 ? `${fameRef.current.badge} ${playerNameRef.current || 'YOU'}` : playerNameRef.current || 'YOU',
        L.playerX,
        L.bodyY - 78 * s,
        s,
      )
      drawNameplate(ctx, opponent.alias, L.enemyX, L.bodyY - 78 * s, s)

      // 총구 연기는 인물 위에 얹혀야 자연스럽다 (In-place zero-allocation update)
      const smokes = smokeRef.current
      let smokeWriteIdx = 0
      for (let i = 0; i < smokes.length; i++) {
        const p = smokes[i]
        p.life -= p.decay
        if (p.life > 0) {
          p.x += p.vx
          p.y += p.vy
          p.vy -= 0.006
          p.vx *= 0.985
          p.size += 0.5
          ctx.fillStyle = `rgba(226, 214, 196, ${p.life * 0.3})`
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size * s, 0, Math.PI * 2)
          ctx.fill()
          if (smokeWriteIdx !== i) smokes[smokeWriteIdx] = p
          smokeWriteIdx++
        }
      }
      smokes.length = smokeWriteIdx

      drawHolster(ctx, {
        cx: L.holsterX,
        top: L.holsterY,
        s: L.hs,
        spanHalf: w / 2 / L.hs + 24,
        state: phaseRef.current === 'idle' ? 'idle' : holding ? 'grip' : 'empty',
        hot: pointerRef.current.inHolster && phaseRef.current === 'idle',
        t,
      })

      if (phaseRef.current === 'idle') {
        const blink = 0.6 + Math.sin(t / 220) * 0.4
        const hintY = L.holsterY - 18 * L.hs
        ctx.font = `800 ${Math.round(13.5 * s)}px ${CANVAS_LABEL_FONT}`
        ctx.textAlign = 'center'
        const label = '👇 홀스터를 꾹 누르고 있어라 (HOLD)'
        const tw = ctx.measureText(label).width
        ctx.fillStyle = 'rgba(10, 5, 2, 0.85)'
        ctx.fillRect(L.holsterX - tw / 2 - 12, hintY - 14 * s, tw + 24, 20 * s)
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.4)'
        ctx.lineWidth = 1
        ctx.strokeRect(L.holsterX - tw / 2 - 12, hintY - 14 * s, tw + 24, 20 * s)
        ctx.globalAlpha = blink
        ctx.fillStyle = '#ffd700'
        ctx.fillText(label, L.holsterX, hintY)
        ctx.globalAlpha = 1
      }

      if (holding && countdownRef.current !== null) {
        const wob = Math.sin(t / 40) * 3
        ctx.save()
        ctx.translate(w / 2, h * 0.2)
        ctx.fillStyle = 'rgba(255, 242, 208, 0.94)'
        ctx.font = `900 ${Math.round(78 * s)}px ${CANVAS_LABEL_FONT}`
        ctx.textAlign = 'center'
        ctx.shadowColor = 'rgba(0,0,0,0.8)'
        ctx.shadowBlur = 16
        ctx.fillText(String(countdownRef.current), wob, 0)

        // 홀딩 중 하단 안내
        ctx.font = `700 ${Math.round(14 * s)}px ${CANVAS_LABEL_FONT}`
        ctx.fillStyle = '#ffe0a0'
        ctx.shadowBlur = 8
        ctx.fillText('진짜 DRAW! 신호가 뜨면 손을 떼고 상대를 클릭!', 0, h * 0.46)
        ctx.restore()
      }

      if (feintActive) {
        ctx.save()
        ctx.translate(w / 2, h * 0.28)
        ctx.fillStyle = 'rgba(196, 72, 60, 0.8)'
        ctx.font = `900 ${Math.round(56 * s)}px ${CANVAS_LABEL_FONT}`
        ctx.textAlign = 'center'
        ctx.fillText('DRAW…?', 0, 0)
        ctx.restore()
      }

      if (phaseRef.current === 'draw') {
        const pulse = 0.9 + Math.sin(t / 50) * 0.12
        ctx.save()
        ctx.translate(w / 2, h * 0.2)
        ctx.scale(pulse, pulse)
        ctx.fillStyle = '#ff2d2d'
        ctx.font = `900 ${Math.round(76 * s)}px ${CANVAS_LABEL_FONT}`
        ctx.textAlign = 'center'
        ctx.shadowColor = 'rgba(0,0,0,0.9)'
        ctx.shadowBlur = 20
        ctx.fillText('DRAW!', 0, 0)

        // DRAW 시 발사 안내
        ctx.font = `800 ${Math.round(18 * s)}px ${CANVAS_LABEL_FONT}`
        ctx.fillStyle = '#ffea60'
        ctx.shadowColor = '#000'
        ctx.shadowBlur = 10
        ctx.fillText('⚡ 상대를 즉시 클릭해 사격!', 0, h * 0.46)
        ctx.restore()
      }

      // 총구 화염 + 옆으로 번지는 렌즈 플레어
      if (phaseRef.current === 'result' && resultFlashRef.current > 0.02) {
        const playerWon = winnerRef.current === 'player'
        const fx = playerWon ? L.playerX + 56 * s : L.enemyX - 56 * s
        const fy = L.bodyY - 20 * s
        const a = resultFlashRef.current

        ctx.save()
        ctx.globalCompositeOperation = 'lighter'
        const mg = ctx.createRadialGradient(fx, fy, 2, fx, fy, 52 * s)
        mg.addColorStop(0, `rgba(255,255,220,${a})`)
        mg.addColorStop(0.35, `rgba(255,168,50,${a * 0.7})`)
        mg.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = mg
        ctx.beginPath()
        ctx.arc(fx, fy, 52 * s, 0, Math.PI * 2)
        ctx.fill()

        const streak = ctx.createLinearGradient(fx - 150 * s, fy, fx + 150 * s, fy)
        streak.addColorStop(0, 'rgba(255,150,60,0)')
        streak.addColorStop(0.5, `rgba(255,190,110,${a * 0.42})`)
        streak.addColorStop(1, 'rgba(255,150,60,0)')
        ctx.fillStyle = streak
        ctx.fillRect(fx - 150 * s, fy - 2.5 * s, 300 * s, 5 * s)
        ctx.restore()

        resultFlashRef.current *= 0.9
      }

      if (phaseRef.current === 'result' && hitMarkRef.current) {
        const m = hitMarkRef.current
        ctx.strokeStyle = m.head ? '#ffe07a' : '#ff6a4a'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(m.x - 12, m.y - 12)
        ctx.lineTo(m.x + 12, m.y + 12)
        ctx.moveTo(m.x + 12, m.y - 12)
        ctx.lineTo(m.x - 12, m.y + 12)
        ctx.stroke()
      }

      // 바닥 먼지 파티클 (In-place zero-allocation update)
      const dusts = dustRef.current
      let dustWriteIdx = 0
      for (let i = 0; i < dusts.length; i++) {
        const d = dusts[i]
        d.life -= d.decay
        if (d.life > 0) {
          d.x += d.vx
          d.y += d.vy
          d.vy += 0.09
          ctx.fillStyle = `rgba(214, 176, 116, ${d.life * 0.7})`
          ctx.beginPath()
          ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2)
          ctx.fill()
          if (dustWriteIdx !== i) dusts[dustWriteIdx] = d
          dustWriteIdx++
        }
      }
      dusts.length = dustWriteIdx

      // 역광에 반짝이는 먼지
      ctx.fillStyle = 'rgba(255, 226, 170, 0.2)'
      for (let i = 0; i < 26; i++) {
        const ax = (i * 137 + t * 0.014 * (1 + (i % 3))) % w
        const ay = L.horizon * 0.5 + ((i * 53) % (h * 0.5)) + Math.sin(t * 0.0009 + i) * 22
        const size = 1 + (i % 3) * 0.6
        ctx.fillRect(ax, ay, size, size)
      }

      // 쇼크웨이브 링 (Shockwave Rings)
      const waves = shockwavesRef.current
      let waveWriteIdx = 0
      for (let i = 0; i < waves.length; i++) {
        const sw = waves[i]
        sw.r += (sw.maxR - sw.r) * 0.22 + 2.5
        sw.alpha -= 0.04
        if (sw.alpha > 0 && sw.r < sw.maxR) {
          ctx.save()
          ctx.strokeStyle = sw.color
          ctx.globalAlpha = sw.alpha
          ctx.lineWidth = 3.5 * s
          ctx.shadowColor = sw.color
          ctx.shadowBlur = 14
          ctx.beginPath()
          ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2)
          ctx.stroke()
          ctx.restore()
          if (waveWriteIdx !== i) waves[waveWriteIdx] = sw
          waveWriteIdx++
        }
      }
      waves.length = waveWriteIdx

      // 탄피 물리 파티클 (Brass Shell Ejection)
      const shells = shellsRef.current
      let shellWriteIdx = 0
      for (let i = 0; i < shells.length; i++) {
        const sh = shells[i]
        sh.x += sh.vx
        sh.y += sh.vy
        sh.vy += 0.36
        sh.rot += sh.vRot
        if (sh.y >= sh.groundY) {
          sh.y = sh.groundY
          sh.vy = -sh.vy * 0.35
          sh.vx *= 0.55
          sh.vRot *= 0.5
          sh.life -= 0.015
        }
        if (sh.life > 0) {
          ctx.save()
          ctx.translate(sh.x, sh.y)
          ctx.rotate(sh.rot)
          ctx.fillStyle = '#f5c542'
          ctx.shadowColor = '#d49b20'
          ctx.shadowBlur = 4
          ctx.fillRect(-4.5 * s, -1.8 * s, 9 * s, 3.6 * s)
          ctx.fillStyle = '#fff4ba'
          ctx.fillRect(-2 * s, -1.8 * s, 4 * s, 1.2 * s)
          ctx.restore()
          if (shellWriteIdx !== i) shells[shellWriteIdx] = sh
          shellWriteIdx++
        }
      }
      shells.length = shellWriteIdx

      // 플로팅 타격 텍스트 (Floating Combat Impact Text)
      const fts = floatTextsRef.current
      let ftWriteIdx = 0
      for (let i = 0; i < fts.length; i++) {
        const ft = fts[i]
        ft.y -= 0.65
        ft.life -= 0.012
        if (ft.life > 0) {
          ctx.save()
          ctx.globalAlpha = Math.min(1, ft.life * 1.5)
          ctx.font = `900 ${ft.size}px ${CANVAS_LABEL_FONT}`
          ctx.textAlign = 'center'
          ctx.fillStyle = ft.color
          ctx.shadowColor = 'rgba(0,0,0,0.95)'
          ctx.shadowBlur = 10
          ctx.fillText(ft.text, ft.x, ft.y)
          ctx.restore()
          if (ftWriteIdx !== i) fts[ftWriteIdx] = ft
          ftWriteIdx++
        }
      }
      fts.length = ftWriteIdx

      // 홀딩 중에는 화면 가장자리가 부드럽게 집중되며 시야를 모아준다 (자연스러운 영화적 비네트)
      const squeeze = holding ? 0.03 + Math.sin(t / 600) * 0.015 : 0
      const pulseAlpha = holding ? 0.48 + Math.sin(t / 500) * 0.06 : 0.38
      const vig = ctx.createRadialGradient(
        w / 2,
        h * 0.5,
        h * (0.35 - squeeze),
        w / 2,
        h * 0.5,
        h * 0.88,
      )
      vig.addColorStop(0, 'rgba(0,0,0,0)')
      vig.addColorStop(1, `rgba(8, 4, 2, ${pulseAlpha})`)
      ctx.fillStyle = vig
      ctx.fillRect(0, 0, w, h)

      if (phaseRef.current === 'draw') {
        const { x, y } = pointerRef.current
        const onHead = Math.hypot(x - L.enemyX, y - L.headY) <= L.headR
        const onBody = Math.hypot(x - L.enemyX, y - (L.bodyY + 10 * s)) <= L.bodyR
        ctx.strokeStyle = onHead ? '#ffe07a' : onBody ? '#7dffa0' : '#ff5050'
        ctx.lineWidth = 1.6
        ctx.beginPath()
        ctx.arc(x, y, 16, 0, Math.PI * 2)
        ctx.moveTo(x - 24, y)
        ctx.lineTo(x - 6, y)
        ctx.moveTo(x + 6, y)
        ctx.lineTo(x + 24, y)
        ctx.moveTo(x, y - 24)
        ctx.lineTo(x, y - 6)
        ctx.moveTo(x, y + 6)
        ctx.lineTo(x, y + 24)
        ctx.stroke()
      }

      ctx.restore()

      // 시네마 바와 필름 그레인은 흔들림 밖에서 고정되어야 한다
      const bar = Math.round(h * 0.042)
      ctx.fillStyle = '#050301'
      ctx.fillRect(0, 0, w, bar)
      ctx.fillRect(0, h - bar, w, bar)
      drawGrain(ctx, w, h, phaseRef.current === 'result' ? 1.3 : 1)

      fx?.render(canvas, t)

      rafRef.current = requestAnimationFrame(drawFrame)
    }

    rafRef.current = requestAnimationFrame(drawFrame)

    /* ------------------------------ 입력 처리 ------------------------------ */

    const updatePointer = (clientX: number, clientY: number) => {
      const { x, y } = toLocal(clientX, clientY)
      const inHolster = holsterHit(x, y)
      const wasIn = pointerRef.current.inHolster
      const p = pointerRef.current
      p.x = x
      p.y = y
      p.inHolster = inHolster
      if (phaseRef.current === 'holding' && wasIn && !inHolster) breakGrip('leave')
    }

    const onMouseDown = (e: MouseEvent) => {
      updatePointer(e.clientX, e.clientY)
      pointerRef.current.down = true
      if (phaseRef.current === 'idle' && pointerRef.current.inHolster) {
        startGrip()
        return
      }
      if (phaseRef.current === 'draw') shoot(pointerRef.current.x, pointerRef.current.y)
      else if (phaseRef.current === 'holding') breakGrip('release')
    }

    const onMouseUp = () => {
      pointerRef.current.down = false
      if (phaseRef.current === 'holding') breakGrip('release')
    }

    const onMouseMove = (e: MouseEvent) => updatePointer(e.clientX, e.clientY)

    const onMouseLeave = () => {
      pointerRef.current.inHolster = false
      if (phaseRef.current === 'holding') breakGrip('leave')
    }

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault()
      const touch = e.touches[0]
      if (!touch) return
      updatePointer(touch.clientX, touch.clientY)
      pointerRef.current.down = true
      if (phaseRef.current === 'idle' && pointerRef.current.inHolster) {
        startGrip()
        return
      }
      if (phaseRef.current === 'draw') shoot(pointerRef.current.x, pointerRef.current.y)
    }

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      const touch = e.touches[0]
      if (touch) updatePointer(touch.clientX, touch.clientY)
    }

    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault()
      pointerRef.current.down = false
      if (phaseRef.current === 'holding') breakGrip('release')
    }

    canvas.addEventListener('mousedown', onMouseDown)
    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('mouseleave', onMouseLeave)
    window.addEventListener('mouseup', onMouseUp)
    canvas.addEventListener('touchstart', onTouchStart, { passive: false })
    canvas.addEventListener('touchmove', onTouchMove, { passive: false })
    canvas.addEventListener('touchend', onTouchEnd, { passive: false })

    return () => {
      cancelAnimationFrame(rafRef.current)
      clearTimers()
      smokeRef.current = []
      dustRef.current = []
      window.removeEventListener('resize', resize)
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('mouseleave', onMouseLeave)
      window.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('touchend', onTouchEnd)
      fx?.dispose()
    }
  }, [isFinalBoss, opponent.alias, round, setPhaseSafe, tuning])

  return (
    <div className={`screen duel-screen flash-${flash}`}>
      <div className="duel-meta">
        <p className="eyebrow">
          ROUND {round} · 📍 {themeInfo.name} ({themeInfo.subtitle})
        </p>
        <div className="duel-stats">
          <span>
            상대 반응 <strong>{Math.round(tuning.enemyReaction)}ms</strong>
          </span>
          <span>
            명중 <strong>{(tuning.accuracy * 100).toFixed(0)}%</strong>
          </span>
          <span className="chip-warn">경고 여유 {warningsLeft}</span>
          {streak > 0 && (
            <span
              className="chip-streak"
              style={{ borderColor: fame.color, color: fame.color }}
              title={`현재 명성: ${fame.title} (${fame.subtitle})`}
            >
              {fame.badge} · {streak}연승
            </span>
          )}
          {tuning.hitBonusPercent !== 0 && (
            <span
              className={tuning.hitBonusPercent > 0 ? 'chip-hit-bonus' : 'chip-hit-penalty'}
              title="라운드 난이도, 심리전 결과, 환경 편차 및 전리품이 반영된 조준 판정 배율입니다."
            >
              조준 {tuning.hitBonusPercent > 0 ? `+${tuning.hitBonusPercent}%` : `${tuning.hitBonusPercent}%`}
            </span>
          )}
          {activeBuffs.smoke && (
            <span className="chip-buff chip-smoke" title="서부 연막탄: 상대 명중률 -20% 감소">
              💨 연막탄
            </span>
          )}
          {activeBuffs.powder && (
            <span className="chip-buff chip-powder" title="정밀 화약: 헤드샷 판정 범위 +40% 확대">
              🎯 정밀 화약
            </span>
          )}
          {activeBuffs.bible && (
            <span className="chip-buff chip-bible" title="방탄 포켓 성경: 치명상 피격 시 1회 총알 방어">
              🛡️ 포켓 성경
            </span>
          )}
        </div>
      </div>

      {perks.length > 0 && (
        <div className="perk-strip">
          {perks.map((id) => (
            <span key={id} className="perk-tag" title={perkById(id).desc}>
              <PerkIcon id={id} size={15} />
              {perkById(id).name}
            </span>
          ))}
        </div>
      )}

      {/* 9라운드 최종 보스 3판 2선승제 HUD */}
      {isFinalBoss && (
        <div className="boss-duel-hud">
          <div className="boss-hud-badge">
            <span className="boss-crown">👑</span>
            <span className="boss-title">FINAL BOSS · 3판 2선승제 (BEST OF 3)</span>
          </div>

          <div className="boss-score-board">
            <div className="score-side player">
              <span className="score-name">{playerName || 'YOU'}</span>
              <div className="score-lamps">
                <span className={`lamp${playerScore >= 1 ? ' active win' : ''}`} />
                <span className={`lamp${playerScore >= 2 ? ' active win' : ''}`} />
              </div>
            </div>

            <div className="score-vs">
              <span className="phase-tag">SET {bossSet} / 3</span>
            </div>

            <div className="score-side enemy">
              <div className="score-lamps">
                <span className={`lamp${enemyScore >= 1 ? ' active boss-win' : ''}`} />
                <span className={`lamp${enemyScore >= 2 ? ' active boss-win' : ''}`} />
              </div>
              <span className="score-name">{opponent.alias}</span>
            </div>
          </div>
        </div>
      )}

      <div className="duel-stage">
        <div className="duel-canvas-wrap">
          <canvas ref={canvasRef} />
          <canvas ref={fxCanvasRef} className="duel-fx" aria-hidden />

          {/* 세트 전환 오버레이 자막 (Inter-set Transition) */}
          {interSetBanner && (
            <div className="inter-set-banner-overlay">
              <div className="banner-box">
                <p className="banner-eyebrow">★ FINAL SHOWDOWN · 3판 2선승제 ★</p>
                <h2 className="banner-title">{interSetBanner.title}</h2>
                <p className="banner-sub">{interSetBanner.subtitle}</p>
                <div className="banner-scores">
                  <span className="player-score">
                    {playerName || 'YOU'} <strong>{playerScore}</strong>
                  </span>
                  <span className="vs-sep">:</span>
                  <span className="enemy-score">
                    <strong>{enemyScore}</strong> {opponent.alias}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {warning && <p className="duel-warning">{warning}</p>}

      <p className={`duel-msg phase-${phase}`}>
        {message}
        {grade !== '-' && (
          <span className={`grade grade-${grade}`}>
            {grade} · {GRADE_LABEL[grade]}
          </span>
        )}
      </p>

      <p className="duel-hint">
        {phase === 'idle' &&
          (isFinalBoss
            ? `[SET ${bossSet}/3] 홀스터를 누른 채 3·2·1을 버텨라 — 2승을 먼저 거두는 자가 승리한다`
            : '홀스터를 누른 채 3·2·1을 버텨라 — 손을 떼거나 벗어나면 반칙')}
        {phase === 'holding' &&
          `상대가 움찔하면 곧 뽑는다 (${opponent.tell}) · 가짜 신호 DRAW…?에 속지 마라`}
        {phase === 'draw' && '노란 원(머리)을 맞히면 헤드샷 보너스'}
        {phase === 'result' && (has('steady') ? '' : '경고를 다 쓰면 즉시 패배한다')}
      </p>
    </div>
  )
}

/** 역광 속에서도 읽히도록 이름표에 어두운 받침을 깐다 */
function drawNameplate(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  s: number,
) {
  ctx.font = `700 ${Math.round(13 * s)}px ${CANVAS_LABEL_FONT}`
  ctx.textAlign = 'center'
  const pad = 7 * s
  const tw = ctx.measureText(text).width
  ctx.fillStyle = 'rgba(8, 4, 2, 0.6)'
  ctx.fillRect(x - tw / 2 - pad, y - 12 * s, tw + pad * 2, 17 * s)
  ctx.fillStyle = 'rgba(248, 228, 186, 0.92)'
  ctx.fillText(text, x, y)
}
