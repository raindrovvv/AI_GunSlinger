/**
 * High-Performance BGM Manager for AI Gunslinger
 * - Equal-Power (Sin/Cos) Cinematic Crossfading for smooth transitions
 * - Dynamic Audio Ducking for gunshot impact
 * - Background Tab Auto-Pause/Resume for battery & memory efficiency
 * - Graceful Fallback & Preloading for instant phase switching
 * - Autoplay policy compliance (unlocks on first user gesture)
 * - LocalStorage persistence for mute & volume state
 */

import type { GamePhase } from '../types'

export type BgmTrack = 'title' | 'standoff' | 'duel' | 'newspaper' | 'victory' | 'gameover'

const STORAGE_MUTE_KEY = 'ai-gunslinger.bgm-muted'
const STORAGE_VOL_KEY = 'ai-gunslinger.bgm-volume'

// Track candidates to try in priority order
const TRACK_SOURCES: Record<BgmTrack, string[]> = {
  title: ['/sounds/bgm/title.mp3', '/sounds/bgm/main.mp3'],
  standoff: ['/sounds/bgm/standoff.mp3', '/sounds/bgm/tension.mp3', '/sounds/bgm/title.mp3', '/sounds/bgm/main.mp3'],
  duel: ['/sounds/bgm/duel.mp3', '/sounds/bgm/tension.mp3'],
  newspaper: ['/sounds/bgm/saloon.mp3', '/sounds/bgm/newspaper.mp3', '/sounds/bgm/title.mp3', '/sounds/bgm/main.mp3'],
  victory: ['/sounds/bgm/saloon.mp3', '/sounds/bgm/victory.mp3', '/sounds/bgm/title.mp3', '/sounds/bgm/main.mp3'],
  gameover: ['/sounds/bgm/title.mp3', '/sounds/bgm/gameover.mp3', '/sounds/bgm/main.mp3'],
}

// Track volume balance multipliers
const TRACK_GAINS: Record<BgmTrack, number> = {
  title: 0.72,
  standoff: 0.68,
  duel: 0.45,
  newspaper: 0.65,
  victory: 0.72,
  gameover: 0.6,
}

class BgmManager {
  private currentAudio: HTMLAudioElement | null = null
  private currentTrack: BgmTrack | null = null
  private fadeInterval: number | null = null
  private duckTimeout: number | null = null

  private muted: boolean = false
  private volume: number = 0.55
  private unlocked: boolean = false
  private pendingTrack: BgmTrack | null = null
  private listeners: Set<() => void> = new Set()
  private audioPool: Map<string, HTMLAudioElement> = new Map()

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const savedMute = localStorage.getItem(STORAGE_MUTE_KEY)
        this.muted = savedMute === 'true'
        const savedVol = localStorage.getItem(STORAGE_VOL_KEY)
        if (savedVol != null) {
          const v = parseFloat(savedVol)
          if (!isNaN(v) && v >= 0 && v <= 1) this.volume = v
        }
      } catch {
        /* ignore localStorage error */
      }

      // Handle tab visibility change
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          if (this.currentAudio && !this.currentAudio.paused) {
            this.currentAudio.pause()
          }
        } else {
          if (this.currentAudio && this.currentAudio.paused && !this.muted && this.unlocked) {
            this.currentAudio.play().catch(() => {})
          }
        }
      })
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify() {
    this.listeners.forEach((fn) => fn())
  }

  public isMuted(): boolean {
    return this.muted
  }

  public getVolume(): number {
    return this.volume
  }

  public getCurrentTrack(): BgmTrack | null {
    return this.currentTrack
  }

  /** Preload main tracks into browser cache */
  public preloadTracks(): void {
    if (typeof window === 'undefined') return
    const uniqueUrls = new Set<string>()
    Object.values(TRACK_SOURCES).forEach((arr) => {
      if (arr[0]) uniqueUrls.add(arr[0])
    })

    uniqueUrls.forEach((url) => {
      try {
        const a = new Audio()
        a.src = url
        a.preload = 'auto'
        this.audioPool.set(url, a)
      } catch {
        /* ignore */
      }
    })
  }

  public unlock(): void {
    if (this.unlocked) return
    this.unlocked = true
    this.preloadTracks()

    if (this.pendingTrack) {
      const track = this.pendingTrack
      this.pendingTrack = null
      this.play(track)
    } else if (this.currentAudio && this.currentAudio.paused && !this.muted) {
      this.currentAudio.play().catch(() => {})
    }
  }

  public toggleMute(): boolean {
    return this.setMuted(!this.muted)
  }

  public setMuted(mute: boolean): boolean {
    this.muted = mute
    try {
      localStorage.setItem(STORAGE_MUTE_KEY, String(mute))
    } catch {}

    if (this.currentAudio) {
      if (this.muted) {
        this.currentAudio.volume = 0
      } else {
        const gain = this.currentTrack ? TRACK_GAINS[this.currentTrack] : 0.7
        this.currentAudio.volume = this.volume * gain
        if (this.currentAudio.paused && this.unlocked) {
          this.currentAudio.play().catch(() => {})
        }
      }
    }
    this.notify()
    return this.muted
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol))
    try {
      localStorage.setItem(STORAGE_VOL_KEY, String(this.volume))
    } catch {}

    if (this.currentAudio && !this.muted) {
      const gain = this.currentTrack ? TRACK_GAINS[this.currentTrack] : 0.7
      this.currentAudio.volume = this.volume * gain
    }
    this.notify()
  }

  public playPhase(phase: GamePhase): void {
    switch (phase) {
      case 'title':
        this.play('title')
        break
      case 'loading':
        // Keep current music playing during AI loading
        break
      case 'wanted':
      case 'standoff':
        this.play('standoff')
        break
      case 'duel':
        this.play('duel')
        break
      case 'newspaper':
        this.play('newspaper')
        break
      case 'victory':
        this.play('victory')
        break
      case 'gameover':
        this.play('gameover')
        break
    }
  }

  public play(track: BgmTrack, forceRestart = false): void {
    if (this.currentTrack === track && this.currentAudio && !forceRestart) {
      return
    }

    if (!this.unlocked) {
      this.pendingTrack = track
      this.currentTrack = track
      return
    }

    this.transitionToTrack(track)
  }

  /** Temporarily duck BGM volume during intense SFX (e.g. gunshot) */
  public duck(multiplier = 0.25, restoreTimeMs = 1200): void {
    if (!this.currentAudio || this.muted) return

    const baseGain = this.currentTrack ? TRACK_GAINS[this.currentTrack] : 0.7
    const normalVol = this.volume * baseGain
    this.currentAudio.volume = normalVol * multiplier

    if (this.duckTimeout) clearTimeout(this.duckTimeout)
    this.duckTimeout = window.setTimeout(() => {
      if (this.currentAudio && !this.muted) {
        this.currentAudio.volume = normalVol
      }
    }, restoreTimeMs)
  }

  private async transitionToTrack(track: BgmTrack): Promise<void> {
    const sources = TRACK_SOURCES[track] || []
    if (sources.length === 0) return

    this.currentTrack = track
    const targetGain = TRACK_GAINS[track] ?? 0.7
    const targetVolume = this.muted ? 0 : this.volume * targetGain

    // Select or create audio instance
    let audio: HTMLAudioElement | null = null
    for (const src of sources) {
      try {
        const candidate = this.audioPool.get(src) || new Audio(src)
        candidate.loop = true
        candidate.preload = 'auto'

        const playable = await new Promise<boolean>((resolve) => {
          if (candidate.readyState >= 2) {
            resolve(true)
            return
          }
          const onCanPlay = () => {
            cleanup()
            resolve(true)
          }
          const onError = () => {
            cleanup()
            resolve(false)
          }
          const cleanup = () => {
            candidate.removeEventListener('canplay', onCanPlay)
            candidate.removeEventListener('error', onError)
          }
          candidate.addEventListener('canplay', onCanPlay)
          candidate.addEventListener('error', onError)
          setTimeout(() => {
            cleanup()
            resolve(candidate.readyState >= 2)
          }, 350)
        })

        if (playable) {
          audio = candidate
          this.audioPool.set(src, candidate)
          break
        }
      } catch {
        /* try next candidate */
      }
    }

    if (!audio) {
      this.fadeOutCurrent(500)
      return
    }

    audio.volume = 0
    audio.loop = true

    try {
      await audio.play()
    } catch {
      return
    }

    const oldAudio = this.currentAudio
    this.currentAudio = audio

    if (this.fadeInterval) {
      cancelAnimationFrame(this.fadeInterval)
      this.fadeInterval = null
    }

    // High-precision requestAnimationFrame Equal-Power Crossfade (900ms)
    const durationMs = 900
    const startTime = performance.now()

    const step = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(1, Math.max(0, elapsed / durationMs))

      // Equal power curve: sin(t) for in, cos(t) for out
      const inScale = Math.sin((progress * Math.PI) / 2)
      const outScale = Math.cos((progress * Math.PI) / 2)

      if (this.currentAudio === audio) {
        this.currentAudio.volume = Math.max(0, Math.min(1, targetVolume * inScale))
      }

      if (oldAudio) {
        oldAudio.volume = Math.max(0, oldAudio.volume * outScale)
      }

      if (progress < 1) {
        this.fadeInterval = requestAnimationFrame(step)
      } else {
        this.fadeInterval = null
        if (oldAudio) {
          oldAudio.pause()
          oldAudio.currentTime = 0
        }
      }
    }

    this.fadeInterval = requestAnimationFrame(step)
    this.notify()
  }

  public fadeOutCurrent(durationMs = 600): void {
    const audio = this.currentAudio
    if (!audio) return

    if (this.fadeInterval) {
      cancelAnimationFrame(this.fadeInterval)
      this.fadeInterval = null
    }

    const startVol = audio.volume
    const startTime = performance.now()

    const step = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(1, Math.max(0, elapsed / durationMs))
      const outScale = Math.cos((progress * Math.PI) / 2)
      audio.volume = Math.max(0, startVol * outScale)

      if (progress < 1) {
        this.fadeInterval = requestAnimationFrame(step)
      } else {
        this.fadeInterval = null
        audio.pause()
        audio.currentTime = 0
        if (this.currentAudio === audio) {
          this.currentAudio = null
          this.currentTrack = null
        }
        this.notify()
      }
    }

    this.fadeInterval = requestAnimationFrame(step)
  }
}

export const bgm = new BgmManager()
