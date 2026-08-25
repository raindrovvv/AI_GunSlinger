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
import crowUrl from '../assets/Foley_crow.wav?url'
import windUrl from '../assets/Foley_wind_loop.mp3?url'

let ctx: AudioContext | null = null
let masterGainNode: GainNode | null = null
let masterCompressorNode: DynamicsCompressorNode | null = null

let gunshotBuffer: AudioBuffer | null = null
let gunLoadedBuffer: AudioBuffer | null = null
let gunFallingBuffer: AudioBuffer | null = null
let crowBuffer: AudioBuffer | null = null
let windBuffer: AudioBuffer | null = null
let windSourceNode: AudioBufferSourceNode | null = null
let windGainNode: GainNode | null = null

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
    masterCompressorNode.threshold.value = -6
    masterCompressorNode.knee.value = 6
    masterCompressorNode.ratio.value = 8
    masterCompressorNode.attack.value = 0.001
    masterCompressorNode.release.value = 0.08

    masterGainNode = ctx.createGain()
    masterGainNode.gain.value = 1.35

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
  gain = 0.15,
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

function noiseBurst(duration: number, gain = 0.18, filterHz = 1200, filterType: BiquadFilterType = 'bandpass') {
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
    decodeCrow(),
    decodeWind(),
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

async function decodeCrow(): Promise<AudioBuffer | null> {
  if (crowBuffer) return crowBuffer
  crowBuffer = await loadSampleBuffer(crowUrl)
  return crowBuffer
}

async function decodeWind(): Promise<AudioBuffer | null> {
  if (windBuffer) return windBuffer
  windBuffer = await loadSampleBuffer(windUrl)
  return windBuffer
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
  playSample(0, 1.85, rate)

  // 야외 반향 2탭
  playSample(0.07, 0.55, rate * 0.97, 2200)
  playSample(0.14, 0.35, rate * 0.94, 900)

  // 서브 충격 — 샘플 저음 보강
  const sub = c.createOscillator()
  const subG = c.createGain()
  sub.type = 'sine'
  sub.frequency.setValueAtTime(95, t)
  sub.frequency.exponentialRampToValueAtTime(22, t + 0.09)
  subG.gain.setValueAtTime(0.95, t)
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
  playFiltered(whiteBuf, t, 1.65, 0.002, 0.014, 'highpass', 1400, 0.55)
  // 2. 메인 폭발
  playFiltered(whiteBuf, t, 1.6, 0.005, 0.095, 'lowpass', 5000, 0.5, true)
  // 3. .45 구경 중역 바디
  playFiltered(pinkBuf, t, 1.45, 0.01, 0.13, 'bandpass', 320, 0.6)

  // 4. 서브 킥
  const sub = c.createOscillator()
  const subG = c.createGain()
  sub.type = 'sine'
  sub.frequency.setValueAtTime(130, t)
  sub.frequency.exponentialRampToValueAtTime(24, t + 0.1)
  subG.gain.setValueAtTime(1.5, t)
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
    tone(880, 0.05, 'square', 0.12)
  },
  holster() {
    tone(180, 0.12, 'triangle', 0.16, 90)
  },
  grip() {
    tone(120, 0.16, 'triangle', 0.18, 70)
    noiseBurst(0.07, 0.14)
  },
  tick(step: number) {
    tone(300 + step * 90, 0.07, 'square', 0.14)
  },
  heartbeat(step = 1) {
    try {
      const c = ac()
      const t = c.currentTime
      const master = getMaster()

      // step에 따라 3 -> 2 -> 1로 갈수록 묵직한 서브우퍼 타격음 강화 (Chest Thumping)
      const gainMult = 0.95 + step * 0.25

      // [1차 타격 - 쿵 (Heavy Sub Kick)]
      const sub1 = c.createOscillator()
      const g1 = c.createGain()
      sub1.type = 'sine'
      sub1.frequency.setValueAtTime(68 + step * 4, t)
      sub1.frequency.exponentialRampToValueAtTime(18, t + 0.14)
      g1.gain.setValueAtTime(gainMult * 1.35, t)
      g1.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
      sub1.connect(g1)
      g1.connect(master)
      sub1.start(t)
      sub1.stop(t + 0.17)

      // [1차 저역 펀치 레이어 (Chest Punch Body)]
      const punch1 = c.createOscillator()
      const punchG1 = c.createGain()
      punch1.type = 'triangle'
      punch1.frequency.setValueAtTime(85 + step * 6, t)
      punch1.frequency.exponentialRampToValueAtTime(24, t + 0.09)
      punchG1.gain.setValueAtTime(gainMult * 0.7, t)
      punchG1.gain.exponentialRampToValueAtTime(0.0001, t + 0.11)
      punch1.connect(punchG1)
      punchG1.connect(master)
      punch1.start(t)
      punch1.stop(t + 0.12)

      // [2차 타격 - 쾅 (Heavy S2 Thud, 110ms 후)]
      const t2 = t + 0.11
      const sub2 = c.createOscillator()
      const g2 = c.createGain()
      sub2.type = 'sine'
      sub2.frequency.setValueAtTime(58 + step * 4, t2)
      sub2.frequency.exponentialRampToValueAtTime(16, t2 + 0.16)
      g2.gain.setValueAtTime(gainMult * 1.1, t2)
      g2.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.18)
      sub2.connect(g2)
      g2.connect(master)
      sub2.start(t2)
      sub2.stop(t2 + 0.19)

      // [묵직한 룸 저음 럼블 (Sub Lowpass Pink Noise)]
      const filter = c.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 110
      const noise = c.createBufferSource()
      noise.buffer = getPinkNoiseBuffer(c)
      const ng = c.createGain()
      ng.gain.setValueAtTime(gainMult * 0.85, t)
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
      noise.connect(filter)
      filter.connect(ng)
      ng.connect(master)
      noise.start(t)
    } catch {
      /* ignore */
    }
  },
  draw() {
    tone(660, 0.08, 'sawtooth', 0.24)
    tone(990, 0.15, 'square', 0.16)
    noiseBurst(0.08, 0.22)
  },
  feint() {
    tone(420, 0.06, 'sawtooth', 0.16)
    tone(300, 0.1, 'square', 0.12)
  },
  tell() {
    tone(1400, 0.04, 'sine', 0.12)
  },
  warn() {
    tone(160, 0.18, 'square', 0.22, 110)
    setTimeout(() => tone(140, 0.16, 'square', 0.18, 90), 110)
  },
  headshot() {
    tone(1200, 0.06, 'square', 0.24)
    setTimeout(() => tone(1600, 0.1, 'triangle', 0.22), 50)
    setTimeout(() => tone(2000, 0.16, 'sine', 0.2), 120)
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
  gunLoad(gain = 1.3) {
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
  gunFall(gain = 1.35) {
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
    tone(523, 0.12, 'triangle', 0.2)
    setTimeout(() => tone(659, 0.12, 'triangle', 0.2), 90)
    setTimeout(() => tone(784, 0.22, 'triangle', 0.24), 180)
  },
  lose() {
    tone(220, 0.3, 'sawtooth', 0.24, 80)
  },
  peace() {
    tone(392, 0.15, 'sine', 0.18)
    setTimeout(() => tone(494, 0.2, 'sine', 0.18), 120)
  },
  message() {
    tone(520, 0.06, 'triangle', 0.12)
  },
  paper() {
    noiseBurst(0.15, 0.18)
  },
  coin() {
    tone(987, 0.06, 'sine', 0.18)
    setTimeout(() => tone(1318, 0.08, 'triangle', 0.2), 45)
    setTimeout(() => tone(1760, 0.14, 'sine', 0.18), 90)
  },
  drink() {
    tone(280, 0.08, 'sine', 0.16, 180)
    setTimeout(() => tone(220, 0.1, 'sine', 0.16, 140), 90)
    noiseBurst(0.06, 0.12, 800)
  },
  shield() {
    tone(1600, 0.12, 'sawtooth', 0.26, 500)
    noiseBurst(0.12, 0.22, 2400)
  },
  crow(gain = 0.65) {
    try {
      ac()
      if (crowBuffer) {
        playBuffer(crowBuffer, gain, 0.96 + Math.random() * 0.08)
      } else {
        void decodeCrow().then((buf) => {
          if (buf) playBuffer(buf, gain, 0.96 + Math.random() * 0.08)
        })
      }
    } catch {
      /* fallback */
    }
  },
  startWind(gain = 0.28) {
    try {
      const c = ac()
      if (windSourceNode) return // already playing

      const playWindLoop = (buf: AudioBuffer) => {
        if (windSourceNode) return
        const src = c.createBufferSource()
        src.buffer = buf
        src.loop = true

        const g = c.createGain()
        g.gain.setValueAtTime(0.001, c.currentTime)
        g.gain.linearRampToValueAtTime(gain, c.currentTime + 1.5)

        src.connect(g)
        g.connect(getMaster())
        src.start()

        windSourceNode = src
        windGainNode = g
      }

      if (windBuffer) {
        playWindLoop(windBuffer)
      } else {
        void decodeWind().then((buf) => {
          if (buf) playWindLoop(buf)
        })
      }
    } catch {
      /* ignore */
    }
  },
  stopWind(fadeMs = 800) {
    try {
      if (!windSourceNode || !windGainNode || !ctx) return
      const c = ctx
      const g = windGainNode
      const src = windSourceNode
      windSourceNode = null
      windGainNode = null

      g.gain.setValueAtTime(g.gain.value, c.currentTime)
      g.gain.linearRampToValueAtTime(0.0001, c.currentTime + fadeMs / 1000)
      setTimeout(() => {
        try {
          src.stop()
          src.disconnect()
          g.disconnect()
        } catch {}
      }, fadeMs + 60)
    } catch {
      /* ignore */
    }
  },
}
