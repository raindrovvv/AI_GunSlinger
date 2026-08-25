/** Lightweight Web Audio SFX — no asset files needed */

let ctx: AudioContext | null = null

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

function noiseBurst(duration: number, gain = 0.12) {
  const c = ac()
  const len = Math.floor(c.sampleRate * duration)
  const buffer = c.createBuffer(1, len, c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len)
  const src = c.createBufferSource()
  const g = c.createGain()
  const filter = c.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 1200
  src.buffer = buffer
  g.gain.setValueAtTime(gain, c.currentTime)
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration)
  src.connect(filter)
  filter.connect(g)
  g.connect(c.destination)
  src.start()
}

export const sfx = {
  unlock() {
    try {
      ac()
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
    noiseBurst(0.22, 0.28)
    tone(90, 0.25, 'sawtooth', 0.15, 40)
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
