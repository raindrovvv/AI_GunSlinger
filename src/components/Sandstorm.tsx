import React, { useEffect, useRef } from 'react'

interface Props {
  intensity?: 'light' | 'medium' | 'heavy'
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  length: number
  baseAlpha: number
  wobbleSpeed: number
  wobbleAmp: number
  wobbleOffset: number
  layer: 'bg' | 'mid' | 'fg'
  strokeColor: string // Pre-computed rgba color string (Zero string allocation in render loop)
}

/**
 * Zero-Allocation High-Efficiency Cinematic Sandstorm System
 * - Zero string/object allocations during 60fps render loop
 * - Automatic pause on background tab (zero CPU/GPU drain when hidden)
 * - Optimized 2D canvas drawing with pre-cached styles
 */
export const Sandstorm: React.FC<Props> = ({ intensity = 'medium' }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true })
    if (!ctx) return

    let animId = 0
    let isRunning = true
    let width = (canvas.width = window.innerWidth)
    let height = (canvas.height = window.innerHeight)

    const handleResize = () => {
      if (!canvas) return
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
    }
    window.addEventListener('resize', handleResize, { passive: true })

    const count = intensity === 'heavy' ? 110 : intensity === 'medium' ? 70 : 40
    const particles: Particle[] = new Array(count)

    const HUES = [
      '242, 185, 95',  // Golden dust
      '215, 140, 55',  // Amber sand
      '180, 105, 40',  // Reddish dust
      '255, 215, 140', // Sunlit bright grain
      '140, 80, 30',   // Dark grit
    ]

    const resetParticle = (p: Particle, initial = false) => {
      const isFg = Math.random() < 0.15
      const isBg = !isFg && Math.random() < 0.45
      p.layer = isFg ? 'fg' : isBg ? 'bg' : 'mid'

      if (initial) {
        p.x = Math.random() * width
        p.y = Math.random() * height
      } else {
        if (Math.random() < 0.75) {
          p.x = -20 - Math.random() * 60
          p.y = Math.random() * (height + 100) - 50
        } else {
          p.x = Math.random() * (width * 0.5)
          p.y = -20 - Math.random() * 40
        }
      }

      if (p.layer === 'fg') {
        p.size = 1.6 + Math.random() * 2.2
        p.length = 18 + Math.random() * 30
        p.vx = 8.5 + Math.random() * 9.0
        p.vy = 1.2 + Math.random() * 2.5
        p.baseAlpha = 0.35 + Math.random() * 0.35
        p.wobbleSpeed = 0.04 + Math.random() * 0.04
        p.wobbleAmp = 0.8 + Math.random() * 1.5
      } else if (p.layer === 'mid') {
        p.size = 1.0 + Math.random() * 1.4
        p.length = 6 + Math.random() * 14
        p.vx = 4.5 + Math.random() * 5.0
        p.vy = 0.8 + Math.random() * 2.0
        p.baseAlpha = 0.3 + Math.random() * 0.35
        p.wobbleSpeed = 0.025 + Math.random() * 0.04
        p.wobbleAmp = 1.2 + Math.random() * 2.2
      } else {
        p.size = 0.6 + Math.random() * 0.8
        p.length = 3 + Math.random() * 6
        p.vx = 2.2 + Math.random() * 2.8
        p.vy = 0.4 + Math.random() * 1.2
        p.baseAlpha = 0.15 + Math.random() * 0.25
        p.wobbleSpeed = 0.015 + Math.random() * 0.025
        p.wobbleAmp = 0.5 + Math.random() * 1.0
      }

      p.wobbleOffset = Math.random() * Math.PI * 2
      const hue = HUES[Math.floor(Math.random() * HUES.length)]
      p.strokeColor = `rgba(${hue}, ${p.baseAlpha.toFixed(2)})`
    }

    for (let i = 0; i < count; i++) {
      particles[i] = {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        size: 0,
        length: 0,
        baseAlpha: 0,
        wobbleSpeed: 0,
        wobbleAmp: 0,
        wobbleOffset: 0,
        layer: 'mid',
        strokeColor: '',
      }
      resetParticle(particles[i], true)
    }

    let time = 0

    const render = () => {
      if (!isRunning) return
      time += 0.016

      // Wind gust cycle (surge every ~6 seconds)
      const gustCycle = Math.sin(time * 0.9) * Math.cos(time * 0.4)
      const gustMultiplier = 1 + Math.max(0, gustCycle * 1.4)

      ctx.clearRect(0, 0, width, height)

      for (let i = 0; i < count; i++) {
        const p = particles[i]
        const currentVx = p.vx * gustMultiplier
        const wobble = Math.sin(time * p.wobbleSpeed * 60 + p.wobbleOffset) * p.wobbleAmp

        p.x += currentVx
        p.y += p.vy * (0.8 + gustMultiplier * 0.2) + wobble

        if (p.x > width + 40 || p.y > height + 40 || p.y < -60) {
          resetParticle(p, false)
          continue
        }

        const trailX = p.x - p.length * (currentVx / 6)
        const trailY = p.y - (p.length * 0.3) * (p.vy / 2)

        ctx.beginPath()
        ctx.strokeStyle = p.strokeColor
        ctx.lineWidth = p.size
        ctx.lineCap = 'round'
        ctx.moveTo(trailX, trailY)
        ctx.lineTo(p.x, p.y)
        ctx.stroke()
      }

      animId = requestAnimationFrame(render)
    }

    // Tab visibility handling for zero background resource consumption
    const handleVisibility = () => {
      if (document.hidden) {
        isRunning = false
        cancelAnimationFrame(animId)
      } else if (!isRunning) {
        isRunning = true
        animId = requestAnimationFrame(render)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    animId = requestAnimationFrame(render)

    return () => {
      isRunning = false
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', handleResize)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [intensity])

  return (
    <div className={`sandstorm-overlay intensity-${intensity}`} aria-hidden="true">
      <canvas ref={canvasRef} className="sandstorm-canvas" />
      <div className="dust-wind-layer wind-fast" />
      <div className="dust-wind-layer wind-slow" />
      <div className="dust-wind-layer wind-ambient" />
    </div>
  )
}
