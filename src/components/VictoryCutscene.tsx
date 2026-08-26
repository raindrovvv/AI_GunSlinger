import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { sfx } from '../audio/sfx'
import { bgm } from '../audio/bgm'
import { DEFAULT_PLAYER_NAME } from '../../shared/game'

interface Props {
  playerName?: string
  onComplete: () => void
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  alpha: number
  decay: number
  color: string
}

export function VictoryCutscene({
  playerName = DEFAULT_PLAYER_NAME,
  onComplete,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [sceneIndex, setSceneIndex] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const rafRef = useRef<number>(0)
  const timerRef = useRef<number | null>(null)

  const scenes = useMemo(
    () => [
      {
        eyebrow: 'DUST TOWN · HIGH NOON HAS PASSED',
        title: '아홉 번째 총성이 멎고, 거리에 침묵이 내려앉았다.',
        desc: '더스트 타운을 공포로 몰아넣었던 무법자들은 모두 무릎을 꿇었다.',
        sfxTrigger: () => {
          sfx.holster()
        },
      },
      {
        eyebrow: 'THE UNVANQUISHED DRIFTER',
        title: '피와 화약 연기로 얼룩졌던 황야에 마침내 평온이 깃든다.',
        desc: '서부의 거친 바람마저 그의 발걸음 앞에서는 숨을 죽였다.',
        sfxTrigger: () => {
          sfx.draw()
        },
      },
      {
        eyebrow: 'IMMORTAL WESTERN LEGEND',
        title: `${playerName}, 황야의 불멸한 전설로 영원히 기억되다.`,
        desc: '방아쇠를 당길 때마다 쓰여진 무용담은 이제 서부 전역의 노래가 되었다.',
        sfxTrigger: () => {
          sfx.win()
          sfx.shield()
        },
      },
    ],
    [playerName],
  )

  const nextScene = useCallback(() => {
    if (sceneIndex < scenes.length - 1) {
      setIsTransitioning(true)
      setTimeout(() => {
        setSceneIndex((prev) => prev + 1)
        setIsTransitioning(false)
      }, 400)
    } else {
      sfx.click()
      onComplete()
    }
  }, [sceneIndex, scenes.length, onComplete])

  // Handle scene timer & SFX
  useEffect(() => {
    scenes[sceneIndex]?.sfxTrigger()

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      nextScene()
    }, 4600)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [sceneIndex, scenes, nextScene])

  // Play victory music
  useEffect(() => {
    bgm.play('victory')
  }, [])

  // Canvas Cinematic Animation (Sunset, Dust, Embers, Sun Flare)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = (canvas.width = window.innerWidth)
    let height = (canvas.height = window.innerHeight)

    const onResize = () => {
      if (!canvas) return
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
    }
    window.addEventListener('resize', onResize)

    const particles: Particle[] = []
    const EMBER_COLORS = ['#ffcc00', '#ff9900', '#ff5500', '#ffd700', '#ffffff']

    const spawnEmber = () => {
      particles.push({
        x: Math.random() * width,
        y: height + Math.random() * 40,
        vx: (Math.random() - 0.45) * 1.8,
        vy: -(Math.random() * 1.5 + 0.8),
        size: Math.random() * 3.5 + 1.2,
        alpha: Math.random() * 0.8 + 0.2,
        decay: Math.random() * 0.003 + 0.002,
        color: EMBER_COLORS[Math.floor(Math.random() * EMBER_COLORS.length)],
      })
    }

    // Pre-populate particles
    for (let i = 0; i < 80; i++) {
      spawnEmber()
      const p = particles[particles.length - 1]
      p.y = Math.random() * height
    }

    let startTime = performance.now()

    const render = (now: number) => {
      const elapsed = (now - startTime) * 0.001

      // 1. Dramatic Sunset Sky Gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, height)
      skyGrad.addColorStop(0, '#0d0408')
      skyGrad.addColorStop(0.35, '#2e0f12')
      skyGrad.addColorStop(0.65, '#6a220d')
      skyGrad.addColorStop(0.85, '#cf5a1a')
      skyGrad.addColorStop(1.0, '#e89e38')
      ctx.fillStyle = skyGrad
      ctx.fillRect(0, 0, width, height)

      // 2. Giant Low Sunset Sun
      const sunX = width * 0.5
      const sunY = height * 0.68
      const sunR = Math.min(width, height) * 0.26

      const sunGlow = ctx.createRadialGradient(sunX, sunY, sunR * 0.2, sunX, sunY, sunR * 2.8)
      sunGlow.addColorStop(0, 'rgba(255, 235, 170, 0.95)')
      sunGlow.addColorStop(0.35, 'rgba(240, 130, 40, 0.45)')
      sunGlow.addColorStop(0.7, 'rgba(180, 50, 20, 0.18)')
      sunGlow.addColorStop(1, 'transparent')
      ctx.fillStyle = sunGlow
      ctx.beginPath()
      ctx.arc(sunX, sunY, sunR * 2.8, 0, Math.PI * 2)
      ctx.fill()

      // Sharp Core Sun Disk
      const sunCore = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR)
      sunCore.addColorStop(0, '#ffffff')
      sunCore.addColorStop(0.6, '#ffe699')
      sunCore.addColorStop(0.95, '#ff8833')
      sunCore.addColorStop(1, 'rgba(255, 110, 30, 0.8)')
      ctx.fillStyle = sunCore
      ctx.beginPath()
      ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2)
      ctx.fill()

      // 3. Silhouetted Mountain Ranges (Mesas & Dunes)
      // Distant Mesas
      ctx.fillStyle = 'rgba(28, 8, 12, 0.85)'
      ctx.beginPath()
      ctx.moveTo(0, height * 0.72)
      ctx.lineTo(width * 0.15, height * 0.7)
      ctx.lineTo(width * 0.25, height * 0.66)
      ctx.lineTo(width * 0.38, height * 0.66)
      ctx.lineTo(width * 0.45, height * 0.72)
      ctx.lineTo(width * 0.6, height * 0.69)
      ctx.lineTo(width * 0.72, height * 0.64)
      ctx.lineTo(width * 0.84, height * 0.64)
      ctx.lineTo(width * 0.92, height * 0.71)
      ctx.lineTo(width, height * 0.7)
      ctx.lineTo(width, height)
      ctx.lineTo(0, height)
      ctx.fill()

      // Foreground Dunes
      ctx.fillStyle = '#0f0406'
      ctx.beginPath()
      ctx.moveTo(0, height * 0.78)
      ctx.quadraticCurveTo(width * 0.3, height * 0.74, width * 0.55, height * 0.8)
      ctx.quadraticCurveTo(width * 0.8, height * 0.86, width, height * 0.79)
      ctx.lineTo(width, height)
      ctx.lineTo(0, height)
      ctx.fill()

      // Saguaro Cacti Silhouettes
      const drawCactus = (cx: number, cy: number, scale: number) => {
        ctx.fillStyle = '#080204'
        ctx.fillRect(cx - 5 * scale, cy - 80 * scale, 10 * scale, 85 * scale)
        // Left arm
        ctx.fillRect(cx - 24 * scale, cy - 50 * scale, 20 * scale, 7 * scale)
        ctx.fillRect(cx - 24 * scale, cy - 72 * scale, 7 * scale, 26 * scale)
        // Right arm
        ctx.fillRect(cx + 4 * scale, cy - 36 * scale, 18 * scale, 7 * scale)
        ctx.fillRect(cx + 15 * scale, cy - 56 * scale, 7 * scale, 24 * scale)
      }
      drawCactus(width * 0.14, height * 0.78, 1.1)
      drawCactus(width * 0.88, height * 0.8, 1.3)
      drawCactus(width * 0.78, height * 0.81, 0.7)

      // 4. Hero Gunslinger Silhouette (Walking away towards horizon)
      const heroX = width * 0.5 + Math.sin(elapsed * 0.3) * 12
      const heroY = height * 0.78
      const s = Math.min(width, height) / 750

      ctx.fillStyle = '#060102'
      ctx.save()
      ctx.translate(heroX, heroY)

      // Hat
      ctx.beginPath()
      ctx.ellipse(0, -96 * s, 34 * s, 6 * s, -0.05, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.roundRect(-14 * s, -112 * s, 28 * s, 18 * s, [8 * s, 8 * s, 0, 0])
      ctx.fill()

      // Head & Neck
      ctx.beginPath()
      ctx.arc(0, -92 * s, 10 * s, 0, Math.PI * 2)
      ctx.fill()

      // Duster Coat & Body (billowing slightly in desert wind)
      const windSway = Math.sin(elapsed * 2.5) * 6 * s
      ctx.beginPath()
      ctx.moveTo(-18 * s, -82 * s)
      ctx.lineTo(18 * s, -82 * s)
      ctx.lineTo(24 * s, -20 * s)
      ctx.lineTo(36 * s + windSway, 0)
      ctx.lineTo(-28 * s + windSway * 0.5, 0)
      ctx.lineTo(-22 * s, -20 * s)
      ctx.closePath()
      ctx.fill()

      // Legs
      ctx.fillRect(-14 * s, -20 * s, 10 * s, 32 * s)
      ctx.fillRect(4 * s, -20 * s, 10 * s, 32 * s)

      // Holstered Revolver side silhouette
      ctx.fillRect(-22 * s, -50 * s, 6 * s, 20 * s)

      ctx.restore()

      // 5. Golden Embers / Dust particle simulation
      if (Math.random() < 0.6) spawnEmber()

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.x += p.vx + Math.sin(elapsed * 1.5 + p.y * 0.01) * 0.6
        p.y += p.vy
        p.alpha -= p.decay

        if (p.alpha <= 0 || p.y < 0) {
          particles.splice(i, 1)
          continue
        }

        ctx.fillStyle = p.color
        ctx.globalAlpha = p.alpha
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1.0

      // 6. Subtle Vignette & Film Grain
      const vig = ctx.createRadialGradient(width * 0.5, height * 0.5, width * 0.3, width * 0.5, height * 0.5, width * 0.75)
      vig.addColorStop(0, 'transparent')
      vig.addColorStop(1, 'rgba(5, 1, 2, 0.6)')
      ctx.fillStyle = vig
      ctx.fillRect(0, 0, width, height)

      rafRef.current = requestAnimationFrame(render)
    }

    rafRef.current = requestAnimationFrame(render)

    return () => {
      window.removeEventListener('resize', onResize)
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const current = scenes[sceneIndex]

  return (
    <div
      className="cutscene-container"
      onClick={nextScene}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') nextScene()
      }}
    >
      <canvas ref={canvasRef} className="cutscene-canvas" />

      {/* Cinematic Anamorphic Letterbox Bars */}
      <div className="letterbox-bar top" />
      <div className="letterbox-bar bottom" />

      {/* Skip Button */}
      <button
        type="button"
        className="btn-cutscene-skip"
        onClick={(e) => {
          e.stopPropagation()
          sfx.click()
          onComplete()
        }}
      >
        건너뛰기 (SKIP) ➔
      </button>

      {/* Center Cinematic Content */}
      <div className={`cutscene-content${isTransitioning ? ' fade-out' : ' fade-in'}`}>
        <p className="cutscene-eyebrow">★ {current.eyebrow} ★</p>
        <h1 className="cutscene-title">{current.title}</h1>
        <p className="cutscene-desc">{current.desc}</p>

        {sceneIndex === 2 && (
          <div className="cutscene-medal-badge pulse">
            <span className="star-icon">★</span>
            <strong>IMMORTAL GUNSLINGER</strong>
            <span className="star-icon">★</span>
          </div>
        )}
      </div>

      {/* Bottom Scene Indicator / Progress Bars */}
      <div className="cutscene-timeline">
        {scenes.map((_, idx) => (
          <div
            key={idx}
            className={`timeline-segment${idx < sceneIndex ? ' completed' : ''}${idx === sceneIndex ? ' active' : ''}`}
          />
        ))}
      </div>
      <p className="cutscene-hint">화면을 클릭하거나 스페이스바를 누르면 다음 장면으로 넘어갑니다</p>
    </div>
  )
}
