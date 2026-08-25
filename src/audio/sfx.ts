/**
 * High-Performance Low-Latency Web Audio SFX Engine
 * - Zero-allocation audio routing with singleton Master Gain & Compressor
 * - Pre-allocated noise buffer pools to eliminate GC pauses during combat
 * - In-flight decoding cache & Polyphony limiter to prevent audio clipping
 * - Web Audio suspension/resume lifecycle optimization
 */

import gunshotUrl from '../assets/GunshotRevolver_shot.wav?url'
import gunLoadedUrl from '../assets/GunFoleyRevolver_loaded.wav?url'
import gunFallingUrl from '../assets/GunFoleyRevolver_falling.wav?url'

let ctx: AudioContext | null = null
let masterGainNode: GainNode | null = null
let masterCompressorNode: DynamicsCompressorNode | null = null

let gunshotBuffer: AudioBuffer | null = null
let gunLoadedBuffer: AudioBuffer | null = null
let gunFallingBuffer: AudioBuffer | null = null

// Pre-cached procedural buffers for zero-allocation procedural sounds
let pinkNoiseCache: AudioBuffer | null = null
let whiteNoiseCache: AudioBuffer | null = null
let distortionCurveCache: Float32Array<ArrayBuffer> | null = null

// Active voice tracker for polyphony management
let activeVoices = 0
const MAX_CONCURRENT_VOICES = 12

function ac(): AudioContext {
  if (!ctx) {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ctx = new AudioCtx({ latencyHint: 'interactive' })

    masterCompressorNode = ctx.createDynamicsCompressor()
    masterCompressorNode.threshold.value = -8
    masterCompressorNode.knee.value = 4
    masterCompressorNode.ratio.value = 10
    masterCompressorNode.attack.value = 0.001
    masterCompressorNode.release.value = 0.08

    masterGainNode = ctx.createGain()
    masterGainNode.gain.value = 1.0

    masterGainNode.connect(masterCompressorNode)
    masterCompressorNode.connect(ctx.destination)

    // Ensure proper resume when returning from background tab
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {})
      }
    })
  }

  if (ctx.state === 'suspended') {
    void ctx.resume()
  }

  return ctx
}

function getMaster(): GainNode {
  ac()
  return masterGainNode!
}

function tone(
  freq: number,
  duration: number,
  type: OscillatorType = 'square',
  gain = 0.08,
  slideTo?: number,
) {
  if (activeVoices >= MAX_CONCURRENT_VOICES) return
  activeVoices++

  const c = ac()
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, c.currentTime)
  if (slideTo !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), c.currentTime + duration)
  }
  g.gain.setValueAtTime(gain, c.currentTime)
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration)
  osc.connect(g)
  g.connect(getMaster())
  osc.start()
  osc.stop(c.currentTime + duration)

  osc.onended = () => {
    activeVoices = Math.max(0, activeVoices - 1)
    try {
      osc.disconnect()
      g.disconnect()
    } catch {}
  }
}

function noiseBurst(duration: number, gain = 0.12, filterHz = 1200, filterType: BiquadFilterType = 'bandpass') {
  if (activeVoices >= MAX_CONCURRENT_VOICES) return
  activeVoices++

  const c = ac()
  const len = Math.floor(c.sampleRate * duration)
  const buffer = c.createBuffer(1, len, c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len)
  const src = c.createBufferSource()
  const g = c.createGain()
  const filter = c.createBiquadFilter()
  filter.type = filterType
  filter.frequency.value = filterHz
  src.buffer = buffer
  g.gain.setValueAtTime(gain, c.currentTime)
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration)
  src.connect(filter)
  filter.connect(g)
  g.connect(getMaster())
  src.start()

  src.onended = () => {
    activeVoices = Math.max(0, activeVoices - 1)
    try {
      src.disconnect()
      filter.disconnect()
      g.disconnect()
    } catch {}
  }
}

function distortionCurve(drive = 42): Float32Array<ArrayBuffer> {
  if (distortionCurveCache) return distortionCurveCache
  const n = 256
  const curve = new Float32Array(new ArrayBuffer(n * 4))
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1
    curve[i] = Math.tanh(drive * x) / Math.tanh(drive)
  }
  distortionCurveCache = curve
  return curve
}

function getPinkNoiseBuffer(c: AudioContext): AudioBuffer {
  if (pinkNoiseCache) return pinkNoiseCache
  const len = Math.floor(c.sampleRate * 0.5)
  const buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0)
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1
    b0 = 0.99886 * b0 + white * 0.0555179
    b1 = 0.99332 * b1 + white * 0.0750759
    b2 = 0.969 * b2 + white * 0.153852
    b3 = 0.8665 * b3 + white * 0.3104856
    b4 = 0.55 * b4 + white * 0.5329522
    b5 = -0.7616 * b5 - white * 0.016898
    const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11
    b6 = white * 0.115926
    d[i] = pink
  }
  pinkNoiseCache = buf
  return buf
}

function getWhiteNoiseBuffer(c: AudioContext): AudioBuffer {
  if (whiteNoiseCache) return whiteNoiseCache
  const len = Math.floor(c.sampleRate * 0.5)
  const buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) {
    d[i] = Math.random() * 2 - 1
  }
  whiteNoiseCache = buf
  return buf
}

const bufferCache = new Map<string, Promise<AudioBuffer | null>>()

async function loadSampleBuffer(url: string): Promise<AudioBuffer | null> {
  const cached = bufferCache.get(url)
  if (cached) return cached

  const promise = (async () => {
    try {
      const res = await fetch(url)
      if (!res.ok) return null
      const arrayBuffer = await res.arrayBuffer()
      const c = ac()
      return await c.decodeAudioData(arrayBuffer)
    } catch {
      return null
    }
  })()

  bufferCache.set(url, promise)
  return promise
}

export function preloadGunshot(): Promise<void> {
  return Promise.all([
    decodeGunshot(),
    decodeGunLoaded(),
    decodeGunFalling(),
  ]).then(() => {})
}

async function decodeGunshot(): Promise<AudioBuffer | null> {
  if (gunshotBuffer) return gunshotBuffer
  gunshotBuffer = await loadSampleBuffer(gunshotUrl)
  return gunshotBuffer
}

async function decodeGunLoaded(): Promise<AudioBuffer | null> {
  if (gunLoadedBuffer) return gunLoadedBuffer
  gunLoadedBuffer = await loadSampleBuffer(gunLoadedUrl)
  return gunLoadedBuffer
}

async function decodeGunFalling(): Promise<AudioBuffer | null> {
  if (gunFallingBuffer) return gunFallingBuffer
  gunFallingBuffer = await loadSampleBuffer(gunFallingUrl)
  return gunFallingBuffer
}

function playBuffer(buf: AudioBuffer, gain = 1, rate = 1) {
  const c = ac()
  const src = c.createBufferSource()
  const g = c.createGain()
  src.buffer = buf
  src.playbackRate.value = rate
  g.gain.setValueAtTime(gain, c.currentTime)
  src.connect(g)
  g.connect(getMaster())
  src.start()
}

/** 녹음 샘플 + 서브 + 야외 메아리 */
function sampleGunshot(): boolean {
  if (!gunshotBuffer) return false

  const c = ac()
  const t = c.currentTime
  const rate = 0.96 + Math.random() * 0.08
  const master = getMaster()

  const playSample = (offset: number, gainPeak: number, playbackRate: number, filterHz?: number) => {
    const src = c.createBufferSource()
    src.buffer = gunshotBuffer!
    src.playbackRate.value = playbackRate
    const g = c.createGain()
    g.gain.setValueAtTime(gainPeak, t + offset)
    g.gain.exponentialRampToValueAtTime(0.0001, t + offset + 0.55 / playbackRate)
    if (filterHz) {
      const f = c.createBiquadFilter()
      f.type = 'lowpass'
      f.frequency.value = filterHz
      src.connect(f)
      f.connect(g)
    } else {
      src.connect(g)
    }
    g.connect(master)
    src.start(t + offset)
  }

  // 메인 총성 (실녹음)
  playSample(0, 1.4, rate)

  // 야외 반향 2탭
  playSample(0.07, 0.4, rate * 0.97, 2200)
  playSample(0.14, 0.25, rate * 0.94, 900)

  // 서브 충격 — 샘플 저음 보강
  const sub = c.createOscillator()
  const subG = c.createGain()
  sub.type = 'sine'
  sub.frequency.setValueAtTime(95, t)
  sub.frequency.exponentialRampToValueAtTime(22, t + 0.09)
  subG.gain.setValueAtTime(0.7, t)
  subG.gain.exponentialRampToValueAtTime(0.0001, t + 0.11)
  sub.connect(subG)
  subG.connect(master)
  sub.start(t)
  sub.stop(t + 0.12)

  return true
}

/** 샘플 로드 실패 시 procedural 폴백 */
function proceduralGunshot() {
  const c = ac()
  const t = c.currentTime
  const master = getMaster()
  const whiteBuf = getWhiteNoiseBuffer(c)
  const pinkBuf = getPinkNoiseBuffer(c)

  function playFiltered(
    buf: AudioBuffer,
    at: number,
    peak: number,
    hold: number,
    release: number,
    type: BiquadFilterType,
    freq: number,
    q = 0.7,
    distorted = false,
  ) {
    const filter = c.createBiquadFilter()
    filter.type = type
    filter.frequency.value = freq
    filter.Q.value = q

    const src = c.createBufferSource()
    src.buffer = buf
    const g = c.createGain()
    g.gain.setValueAtTime(peak, at)
    g.gain.exponentialRampToValueAtTime(peak * 0.35, at + hold)
    g.gain.exponentialRampToValueAtTime(0.0001, at + hold + release)

    src.connect(filter)
    if (distorted) {
      const localShaper = c.createWaveShaper()
      localShaper.curve = distortionCurve(52)
      localShaper.oversample = '4x'
      filter.connect(localShaper)
      localShaper.connect(g)
    } else {
      filter.connect(g)
    }
    g.connect(master)
    src.start(at)
  }

  // 1. 총구 크랙
  playFiltered(whiteBuf, t, 1.25, 0.002, 0.014, 'highpass', 1400, 0.55)
  // 2. 메인 폭발
  playFiltered(whiteBuf, t, 1.2, 0.005, 0.095, 'lowpass', 5000, 0.5, true)
  // 3. .45 구경 중역 바디
  playFiltered(pinkBuf, t, 1.05, 0.01, 0.13, 'bandpass', 320, 0.6)

  // 4. 서브 킥
  const sub = c.createOscillator()
  const subG = c.createGain()
  sub.type = 'sine'
  sub.frequency.setValueAtTime(130, t)
  sub.frequency.exponentialRampToValueAtTime(24, t + 0.1)
  subG.gain.setValueAtTime(1.2, t)
  subG.gain.exponentialRampToValueAtTime(0.0001, t + 0.13)
  sub.connect(subG)
  subG.connect(master)
  sub.start(t)
  sub.stop(t + 0.14)
}

export const sfx = {
  unlock() {
    try {
      ac()
      void decodeGunshot()
      void decodeGunLoaded()
      void decodeGunFalling()
    } catch {
      /* ignore */
    }
  },
  click() {
    tone(880, 0.05, 'square', 0.04)
  },
  holster() {
    tone(180, 0.12, 'triangle', 0.06, 90)
  },
  grip() {
    tone(120, 0.16, 'triangle', 0.07, 70)
    noiseBurst(0.07, 0.05)
  },
  tick(step: number) {
    tone(300 + step * 90, 0.07, 'square', 0.05)
  },
  draw() {
    tone(660, 0.08, 'sawtooth', 0.1)
    tone(990, 0.15, 'square', 0.06)
    noiseBurst(0.08, 0.1)
  },
  feint() {
    tone(420, 0.06, 'sawtooth', 0.07)
    tone(300, 0.1, 'square', 0.04)
  },
  tell() {
    tone(1400, 0.04, 'sine', 0.035)
  },
  warn() {
    tone(160, 0.18, 'square', 0.09, 110)
    setTimeout(() => tone(140, 0.16, 'square', 0.07, 90), 110)
  },
  headshot() {
    tone(1200, 0.06, 'square', 0.1)
    setTimeout(() => tone(1600, 0.1, 'triangle', 0.09), 50)
    setTimeout(() => tone(2000, 0.16, 'sine', 0.07), 120)
  },
  gunshot() {
    try {
      ac()
      if (sampleGunshot()) return
      void decodeGunshot().then((buf) => {
        if (buf && sampleGunshot()) return
        proceduralGunshot()
      })
    } catch {
      proceduralGunshot()
    }
  },
  gunLoad(gain = 0.8) {
    try {
      ac()
      if (gunLoadedBuffer) {
        playBuffer(gunLoadedBuffer, gain, 0.98 + Math.random() * 0.04)
      } else {
        void decodeGunLoaded().then((buf) => {
          if (buf) playBuffer(buf, gain)
        })
      }
    } catch {
      /* fallback */
    }
  },
  gunFall(gain = 0.85) {
    try {
      ac()
      if (gunFallingBuffer) {
        playBuffer(gunFallingBuffer, gain, 0.96 + Math.random() * 0.08)
      } else {
        void decodeGunFalling().then((buf) => {
          if (buf) playBuffer(buf, gain)
        })
      }
    } catch {
      /* fallback */
    }
  },
  win() {
    tone(523, 0.12, 'triangle', 0.08)
    setTimeout(() => tone(659, 0.12, 'triangle', 0.08), 90)
    setTimeout(() => tone(784, 0.22, 'triangle', 0.1), 180)
  },
  lose() {
    tone(220, 0.3, 'sawtooth', 0.1, 80)
  },
  peace() {
    tone(392, 0.15, 'sine', 0.07)
    setTimeout(() => tone(494, 0.2, 'sine', 0.07), 120)
  },
  message() {
    tone(520, 0.06, 'triangle', 0.04)
  },
  paper() {
    noiseBurst(0.15, 0.06)
  },
  coin() {
    tone(987, 0.06, 'sine', 0.07)
    setTimeout(() => tone(1318, 0.08, 'triangle', 0.09), 45)
    setTimeout(() => tone(1760, 0.14, 'sine', 0.08), 90)
  },
  drink() {
    tone(280, 0.08, 'sine', 0.06, 180)
    setTimeout(() => tone(220, 0.1, 'sine', 0.06, 140), 90)
    noiseBurst(0.06, 0.04, 800)
  },
  shield() {
    tone(1600, 0.12, 'sawtooth', 0.14, 500)
    noiseBurst(0.12, 0.1, 2400)
  },
}
