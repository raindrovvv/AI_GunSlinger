/** Lightweight Web Audio SFX — procedural + recorded gunshot sample */

import gunshotUrl from '../assets/gunshot.wav?url'

let ctx: AudioContext | null = null
let gunshotBuffer: AudioBuffer | null = null
let gunshotBytes: ArrayBuffer | null = null
let gunshotFetch: Promise<ArrayBuffer | null> | null = null

function ac(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function tone(
  freq: number,
  duration: number,
  type: OscillatorType = 'square',
  gain = 0.08,
  slideTo?: number,
) {
  const c = ac()
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, c.currentTime)
  if (slideTo !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), c.currentTime + duration)
  }
  g.gain.setValueAtTime(gain, c.currentTime)
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration)
  osc.connect(g)
  g.connect(c.destination)
  osc.start()
  osc.stop(c.currentTime + duration)
}

function noiseBurst(duration: number, gain = 0.12, filterHz = 1200, filterType: BiquadFilterType = 'bandpass') {
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
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration)
  src.connect(filter)
  filter.connect(g)
  g.connect(c.destination)
  src.start()
}

function distortionCurve(drive = 42) {
  const n = 256
  const curve = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1
    curve[i] = Math.tanh(drive * x) / Math.tanh(drive)
  }
  return curve
}

/** 핑크 노이즈 버퍼 — 총성 몸통에 더 자연스러움 */
function makePinkNoise(dur: number, decaySec: number) {
  const c = ac()
  const len = Math.floor(c.sampleRate * dur)
  const buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0)
  let b0 = 0
  let b1 = 0
  let b2 = 0
  let b3 = 0
  let b4 = 0
  let b5 = 0
  let b6 = 0
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
    d[i] = pink * Math.exp(-i / (c.sampleRate * decaySec))
  }
  return buf
}

function makeWhiteNoise(dur: number, decaySec: number, decayPow = 1) {
  const c = ac()
  const len = Math.floor(c.sampleRate * dur)
  const buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) {
    const env = decayPow === 1 ? Math.exp(-i / (c.sampleRate * decaySec)) : Math.pow(1 - i / len, decayPow)
    d[i] = (Math.random() * 2 - 1) * env
  }
  return buf
}

/** 바이트만 미리 받아 둔다. AudioContext는 사용자 제스처 뒤에 연다. */
export function preloadGunshot(): Promise<ArrayBuffer | null> {
  return fetchGunshotBytes()
}

function fetchGunshotBytes(): Promise<ArrayBuffer | null> {
  if (gunshotBytes) return Promise.resolve(gunshotBytes)
  if (gunshotFetch) return gunshotFetch

  gunshotFetch = fetch(gunshotUrl)
    .then(async (res) => {
      if (!res.ok) return null
      const type = res.headers.get('content-type') ?? ''
      if (type.includes('text/html')) return null
      const raw = await res.arrayBuffer()
      if (raw.byteLength < 44) return null
      gunshotBytes = raw
      return raw
    })
    .catch(() => {
      gunshotFetch = null
      return null
    })

  return gunshotFetch
}

async function decodeGunshot(): Promise<AudioBuffer | null> {
  if (gunshotBuffer) return gunshotBuffer
  const raw = await fetchGunshotBytes()
  if (!raw) return null
  try {
    const buf = await ac().decodeAudioData(raw.slice(0))
    gunshotBuffer = buf
    return buf
  } catch {
    return null
  }
}

/** 녹음 샘플 + 서브 + 야외 메아리 */
function sampleGunshot() {
  if (!gunshotBuffer) return false

  const c = ac()
  const t = c.currentTime
  const rate = 0.96 + Math.random() * 0.08

  const master = c.createGain()
  master.gain.value = 1.05
  const comp = c.createDynamicsCompressor()
  comp.threshold.value = -10
  comp.knee.value = 0
  comp.ratio.value = 12
  comp.attack.value = 0.0005
  comp.release.value = 0.09
  master.connect(comp)
  comp.connect(c.destination)

  const playSample = (offset: number, gainPeak: number, playbackRate: number, filterHz?: number) => {
    const src = c.createBufferSource()
    src.buffer = gunshotBuffer!
    src.playbackRate.value = playbackRate
    const g = c.createGain()
    g.gain.setValueAtTime(gainPeak, t + offset)
    g.gain.exponentialRampToValueAtTime(0.0001, t + offset + 0.45 / playbackRate)
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
  playSample(0, 1.35, rate)

  // 야외 반향 2탭
  playSample(0.07, 0.38, rate * 0.97, 2200)
  playSample(0.14, 0.22, rate * 0.94, 900)

  // 서브 충격 — 샘플 저음 보강
  const sub = c.createOscillator()
  const subG = c.createGain()
  sub.type = 'sine'
  sub.frequency.setValueAtTime(95, t)
  sub.frequency.exponentialRampToValueAtTime(22, t + 0.09)
  subG.gain.setValueAtTime(0.65, t)
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

  const master = c.createGain()
  master.gain.value = 0.88
  const comp = c.createDynamicsCompressor()
  comp.threshold.value = -14
  comp.knee.value = 1
  comp.ratio.value = 14
  comp.attack.value = 0.0008
  comp.release.value = 0.1
  master.connect(comp)
  comp.connect(c.destination)

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

  // 0. 충격 임펄스 — 1~2ms 전 대역 스파이크
  {
    const len = Math.max(2, Math.floor(c.sampleRate * 0.002))
    const buf = c.createBuffer(1, len, c.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len)
    playFiltered(buf, t, 1.55, 0.001, 0.004, 'highpass', 600, 0.4)
  }

  // 1. 총구 크랙 — 초단파 고음
  playFiltered(makeWhiteNoise(0.014, 0.003, 3), t, 1.25, 0.002, 0.014, 'highpass', 1400, 0.55)

  // 2. 메인 폭발 — 왜곡 풀스펙트럼
  playFiltered(makeWhiteNoise(0.1, 0.015, 1.1), t, 1.2, 0.005, 0.095, 'lowpass', 5000, 0.5, true)

  // 3. .45 구경 중역 바디
  playFiltered(makePinkNoise(0.16, 0.028), t, 1.05, 0.01, 0.13, 'bandpass', 320, 0.6)

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

  // 5. 화약·탄피 고역
  playFiltered(makeWhiteNoise(0.05, 0.006, 3.5), t, 0.85, 0.002, 0.045, 'bandpass', 3200, 1.4)

  // 6. 야외 메아리 (2탄)
  playFiltered(makePinkNoise(0.24, 0.07), t + 0.065, 0.42, 0.015, 0.2, 'bandpass', 580, 0.5)
  playFiltered(makePinkNoise(0.4, 0.11), t + 0.13, 0.26, 0.03, 0.32, 'lowpass', 420)
}

export const sfx = {
  unlock() {
    try {
      ac()
      void decodeGunshot()
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
}
