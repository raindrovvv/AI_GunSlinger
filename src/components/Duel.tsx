import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { bgm } from '../audio/bgm'
import { sfx } from '../audio/sfx'
import { CANVAS_LABEL_FONT } from '../fonts'
import { perkById } from '../data/perks'
import { PerkIcon } from './PerkIcon'
import { geometryOf, getBackdrop } from '../canvas/backdrop'
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
  streak: number
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

export function Duel({ opponent, mods, round, perks, streak, onResult }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [message, setMessage] = useState('홀스터를 누른 채 버텨라')
  const [countdown, setCountdown] = useState<number | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [grade, setGrade] = useState<DrawGrade>('-')
  const [flash, setFlash] = useState<'none' | 'draw' | 'win' | 'lose'>('none')

  const has = useCallback((id: PerkId) => perks.includes(id), [perks])

  const tuning = useMemo(() => {
    // Deterministic jitter per opponent/round to maintain purity
    const jitter = (((opponent.name.length * 17 + round * 23) % 41) - 20)
    return {
      warnings: 1 + (perks.includes('steady') ? 1 : 0),
      hitScale: perks.includes('keen') ? 1.3 : 1,
      headScale: perks.includes('silver') ? 1.2 : 1,
      fastGrace: perks.includes('fast') ? 60 : 0,
      enemyReaction: Math.max(
        170,
        opponent.baseReactionMs +
          mods.reactionDeltaMs +
          jitter +
          (perks.includes('charm') ? 35 : 0),
      ),
      accuracy: Math.min(0.99, Math.max(0.2, opponent.baseAccuracy + mods.accuracyDelta)),
    }
  }, [opponent.name, opponent.baseReactionMs, opponent.baseAccuracy, mods.reactionDeltaMs, mods.accuracyDelta, perks, round])

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
  const resolvedRef = useRef(false)
  const dustRef = useRef<Particle[]>([])
  const smokeRef = useRef<Particle[]>([])
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

    const resize = () => {
      const parent = canvas.parentElement
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      const cssW = Math.min(920, parent?.clientWidth ?? 800)
      const cssH = Math.min(580, Math.max(420, Math.floor(cssW * 0.68)))
      canvas.style.width = `${cssW}px`
      canvas.style.height = `${cssH}px`
      canvas.width = Math.floor(cssW * dpr)
      canvas.height = Math.floor(cssH * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const layout = () => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      const g = geometryOf(w, h)
      // 캔버스가 작아지면 인물과 홀스터를 함께 줄여 화면 밖으로 밀려나지 않게 한다
      const s = Math.max(0.7, Math.min(1.05, h / 540))
      const bodyY = g.horizon + h * 0.06
      // 홀스터는 전경이므로 인물 발밑에 남은 공간에 딱 맞춰 키운다.
      // 그러지 않으면 벨트가 상대의 다리를 가로지른다.
      const bar = h * 0.042
      const room = h - bar - (bodyY + 78 * s) - 10
      const hs = Math.max(0.6, Math.min(s * 1.5, room / 98))
      return {
        w,
        h,
        horizon: g.horizon,
        s,
        hs,
        playerX: w * 0.18,
        enemyX: w * 0.82,
        bodyY,
        headY: bodyY - 30 * s,
        bodyR: 48 * s * tuning.hitScale,
        headR: 19 * s * tuning.hitScale * tuning.headScale,
        holsterX: w * 0.5,
        holsterY: h - bar - 6 - 98 * hs,
      }
    }

    const holsterHit = (x: number, y: number) => {
      const L = layout()
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
      winnerRef.current = outcome.won ? 'player' : 'enemy'
      fallStartRef.current = performance.now()
      resultFlashRef.current = 1
      shakeRef.current = outcome.won ? 13 : 10
      setFlash(outcome.won ? 'win' : 'lose')
      setMessage(outcome.detail)
      setGrade(outcome.grade)

      if (!outcome.foul) {
        const L = layout()
        const shooterX = outcome.won ? L.playerX : L.enemyX
        const dir = outcome.won ? 1 : -1
        spawnSmoke(shooterX + dir * 56 * L.s, L.bodyY - 20 * L.s, dir)
        bgm.duck(0.18, 1200)
        sfx.gunshot()
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
      enemyShotAtRef.current = drawAtRef.current + tuning.enemyReaction
      setPhaseSafe('draw')
      setFlash('draw')
      setMessage('쏴라!')
      sfx.draw()
      shakeRef.current = 8
      later(() => setFlash('none'), 200)
      later(() => {
        if (phaseRef.current === 'draw' && playerShotAtRef.current === null) {
          const enemyHits = Math.random() < effAccuracy()
          const L = layout()
          spawnDust(enemyHits ? L.playerX : L.enemyX, L.bodyY, 16)
          resolve({
            won: !enemyHits,
            detail: enemyHits ? '상대가 먼저 쏘았다.' : '상대가 빗나갔다! 간신히 살았다.',
            reactionMs: null,
            grade: '-',
            headshot: false,
            foul: false,
          })
        }
      }, tuning.enemyReaction + 140)
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

      const feintChance = Math.min(0.7, 0.12 + round * 0.07)
      if (round >= 2 && extra > 700 && Math.random() < feintChance) {
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
      playerShotAtRef.current = now
      const raw = now - drawAtRef.current
      const effective = raw - tuning.fastGrace
      const enemyMs = enemyShotAtRef.current - drawAtRef.current

      const L = layout()
      const dHead = Math.hypot(x - L.enemyX, y - L.headY)
      const dBody = Math.hypot(x - L.enemyX, y - (L.bodyY + 10 * L.s))
      const head = dHead <= L.headR
      const body = !head && dBody <= L.bodyR

      spawnDust(x, y, 6)

      if (!head && !body) {
        if (now >= enemyShotAtRef.current) {
          const enemyHits = Math.random() < effAccuracy()
          resolve({
            won: !enemyHits,
            detail: enemyHits
              ? '허공을 쐈다. 상대의 총알이 먼저였다.'
              : '둘 다 빗나갔다! 운이 좋았다.',
            reactionMs: Math.round(raw),
            grade: '-',
            headshot: false,
            foul: false,
          })
        } else {
          resolve({
            won: false,
            detail: '허공을 쐈다! 조준이 빗나갔다.',
            reactionMs: Math.round(raw),
            grade: '-',
            headshot: false,
            foul: false,
          })
        }
        return
      }

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

      const enemyHits = Math.random() < effAccuracy()
      spawnDust(enemyHits ? L.playerX : L.enemyX, L.bodyY, 16)
      resolve({
        won: !enemyHits,
        detail: enemyHits
          ? `한발 늦었다. 상대 ${Math.round(enemyMs)}ms`
          : '상대가 빗나갔다! 기적적인 생존.',
        reactionMs: Math.round(raw),
        grade: enemyHits ? '-' : gradeOf(raw),
        headshot: false,
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
      if (shakeRef.current > 0.05) shakeRef.current *= 0.88

      ctx.clearRect(0, 0, w, h)
      ctx.save()
      ctx.translate(sx, sy)

      if (phaseRef.current === 'result' && winnerRef.current === 'player') {
        zoomRef.current = Math.min(1, zoomRef.current + 0.05)
        const z = 1 + zoomRef.current * 0.16
        ctx.translate(L.enemyX, L.bodyY)
        ctx.scale(z, z)
        ctx.translate(-L.enemyX, -L.bodyY)
      }

      ctx.drawImage(getBackdrop(w, h, dpr, round), 0, 0, w, h)

      drawVultures(ctx, w, h, t)
      drawTumbleweed(ctx, w, h, L.horizon, t)

      const holding = phaseRef.current === 'holding'
      const tension = holding ? Math.sin(t / 180) * 1.6 : 0
      const drawJitter = phaseRef.current === 'draw' ? Math.sin(t / 24) * 2.5 : 0
      const tellActive = now - tellFlashRef.current < 200
      const feintActive = now < feintUntilRef.current
      const armed = phaseRef.current === 'draw' || phaseRef.current === 'result'

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
        ctx.font = '700 10px monospace'
        ctx.textAlign = 'center'
        ctx.fillText('HEAD', L.enemyX, L.headY - L.headR - 8)
      }

      const fallOf = (side: 'player' | 'enemy') =>
        phaseRef.current === 'result' && winnerRef.current !== side && winnerRef.current !== 'none'
          ? Math.min(1, (now - fallStartRef.current) / 460)
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
        coat: '#2e1414',
        rim: 'rgba(255, 176, 110, 0.85)',
        t,
        twitch: tellActive ? 1 : feintActive ? 0.5 : 0,
      })

      if (tellActive && holding) {
        ctx.fillStyle = 'rgba(255, 240, 160, 0.95)'
        ctx.font = `900 ${Math.round(22 * s)}px ${CANVAS_LABEL_FONT}`
        ctx.textAlign = 'center'
        ctx.fillText('!', L.enemyX + 36 * s, L.bodyY - 62 * s)
      }

      drawNameplate(ctx, 'YOU', L.playerX, L.bodyY - 78 * s, s)
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
        const hintY = L.holsterY - 16 * L.hs
        ctx.font = `700 ${Math.round(13 * s)}px ${CANVAS_LABEL_FONT}`
        ctx.textAlign = 'center'
        const label = '여기를 누른 채 버텨라'
        const tw = ctx.measureText(label).width
        ctx.fillStyle = 'rgba(10, 5, 2, 0.75)'
        ctx.fillRect(L.holsterX - tw / 2 - 10, hintY - 13 * s, tw + 20, 18 * s)
        ctx.globalAlpha = blink
        ctx.fillStyle = '#ffe0a0'
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

      // 홀딩 중에는 비네트가 조여들며 시야가 좁아진다
      const squeeze = holding ? 0.1 + Math.sin(t / 300) * 0.03 : 0
      const vig = ctx.createRadialGradient(
        w / 2,
        h * 0.5,
        h * (0.24 - squeeze),
        w / 2,
        h * 0.5,
        h * 0.82,
      )
      vig.addColorStop(0, 'rgba(0,0,0,0)')
      vig.addColorStop(1, `rgba(8, 4, 2, ${0.62 + squeeze * 1.6})`)
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

      rafRef.current = requestAnimationFrame(drawFrame)
    }

    rafRef.current = requestAnimationFrame(drawFrame)

    /* ------------------------------ 입력 처리 ------------------------------ */

    const updatePointer = (clientX: number, clientY: number) => {
      const { x, y } = toLocal(clientX, clientY)
      const inHolster = holsterHit(x, y)
      const wasIn = pointerRef.current.inHolster
      pointerRef.current = { ...pointerRef.current, x, y, inHolster }
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
    }
  }, [opponent.alias, round, setPhaseSafe, tuning])

  return (
    <div className={`screen duel-screen flash-${flash}`}>
      <div className="duel-meta">
        <p className="eyebrow">ROUND {round} · DUEL</p>
        <div className="duel-stats">
          <span>
            상대 반응 <strong>{Math.round(tuning.enemyReaction)}ms</strong>
          </span>
          <span>
            명중 <strong>{(tuning.accuracy * 100).toFixed(0)}%</strong>
          </span>
          <span className="chip-warn">경고 여유 {warningsLeft}</span>
          {streak > 0 && <span className="chip-streak">연승 {streak}</span>}
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

      <div className="duel-stage">
        <canvas ref={canvasRef} />
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
        {phase === 'idle' && '홀스터를 누른 채 3·2·1을 버텨라 — 손을 떼거나 벗어나면 반칙'}
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
