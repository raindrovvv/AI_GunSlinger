/**
 * 결투 장면의 움직이는 요소들.
 *
 * 태양이 화면 중앙에 있으므로 두 총잡이는 모두 정면에서 빛을 받는 역광 실루엣이다.
 * 로컬 좌표에서는 항상 +x 쪽이 태양 방향이라 림라이트 계산이 단순해진다.
 */

export const HOLSTER_HALF_W = 46
export const HOLSTER_TOP_PAD = 14
export const HOLSTER_REACH = 108

export function roundedPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/* -------------------------------- 총잡이 -------------------------------- */

export interface ActorOpts {
  x: number
  /** 몸통 중심 y */
  y: number
  s: number
  facingRight: boolean
  armed: boolean
  reaching: boolean
  /** 0이면 서 있고 1이면 완전히 쓰러진 상태 */
  fallT: number
  t: number
  twitch: number
  coat: string
  rim: string
}

export function drawGunslinger(ctx: CanvasRenderingContext2D, o: ActorOpts) {
  const { x, y, s, facingRight, armed, reaching, fallT, t, twitch, coat, rim } = o

  drawLongShadow(ctx, x, y + 78 * s, s, facingRight, fallT)

  ctx.save()
  ctx.translate(x, y)
  ctx.scale(facingRight ? s : -s, s)

  if (fallT > 0) {
    const e = 1 - Math.pow(1 - fallT, 3)
    ctx.translate(-e * 22, e * 34)
    ctx.rotate(-e * 1.45)
  }
  if (twitch > 0) {
    ctx.translate(twitch * 3, -twitch * 2)
    ctx.rotate(twitch * 0.05)
  }

  const breath = fallT > 0 ? 0 : Math.sin(t / 420) * 1.3
  const flap = fallT > 0 ? 0 : Math.sin(t / 260) * 3.4

  // 부츠와 다리
  ctx.fillStyle = '#0b0603'
  ctx.beginPath()
  ctx.moveTo(-16, 40)
  ctx.lineTo(-9, 40)
  ctx.lineTo(-11, 72)
  ctx.lineTo(-20, 76)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(8, 40)
  ctx.lineTo(15, 40)
  ctx.lineTo(19, 76)
  ctx.lineTo(9, 72)
  ctx.closePath()
  ctx.fill()

  // 롱코트 — 아랫단이 바람에 날린다
  const body = ctx.createLinearGradient(-20, 0, 20, 0)
  body.addColorStop(0, '#080402')
  body.addColorStop(0.7, coat)
  body.addColorStop(1, coat)
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.moveTo(-17, -14 + breath)
  ctx.lineTo(17, -14 + breath)
  ctx.quadraticCurveTo(22, 16, 20 + flap, 48)
  ctx.lineTo(-18 + flap * 0.4, 48)
  ctx.quadraticCurveTo(-22, 16, -17, -14 + breath)
  ctx.closePath()
  ctx.fill()

  // 어깨
  ctx.fillStyle = '#0d0704'
  roundedPath(ctx, -19, -16 + breath, 38, 12, 5)
  ctx.fill()

  // 머리와 모자
  ctx.fillStyle = '#0b0603'
  ctx.beginPath()
  ctx.arc(0, -30 + breath, 13, 0, Math.PI * 2)
  ctx.fill()

  ctx.beginPath()
  ctx.ellipse(0, -42 + breath, 27, 6, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(-11, -42 + breath)
  ctx.lineTo(-9, -59 + breath)
  ctx.quadraticCurveTo(0, -62 + breath, 9, -59 + breath)
  ctx.lineTo(11, -42 + breath)
  ctx.closePath()
  ctx.fill()

  // 팔과 총
  drawArm(ctx, { armed, reaching, breath, t })

  // 태양 쪽 윤곽을 따라 흐르는 림라이트. 실루엣을 배경에서 떼어낸다.
  ctx.save()
  ctx.lineCap = 'round'
  ctx.shadowColor = rim
  ctx.shadowBlur = 7
  ctx.strokeStyle = rim
  ctx.lineWidth = 2.6
  ctx.beginPath()
  ctx.moveTo(8, -60 + breath)
  ctx.lineTo(11, -43 + breath)
  ctx.moveTo(13, -43.5 + breath)
  ctx.lineTo(26, -41 + breath)
  ctx.moveTo(11, -30 + breath)
  ctx.quadraticCurveTo(17, -23 + breath, 18, -16 + breath)
  ctx.moveTo(19, -13 + breath)
  ctx.quadraticCurveTo(23, 16, 20 + flap, 47)
  ctx.moveTo(15, 41)
  ctx.lineTo(19, 75)
  ctx.stroke()

  // 모자챙 아래 반사광
  ctx.shadowBlur = 0
  ctx.lineWidth = 1.4
  ctx.globalAlpha = 0.55
  ctx.beginPath()
  ctx.moveTo(-20, -40 + breath)
  ctx.lineTo(20, -40 + breath)
  ctx.stroke()
  ctx.restore()

  ctx.restore()
}

function drawArm(
  ctx: CanvasRenderingContext2D,
  o: { armed: boolean; reaching: boolean; breath: number; t: number },
) {
  const { armed, reaching, breath, t } = o
  ctx.strokeStyle = '#0b0603'
  ctx.lineWidth = 7
  ctx.lineCap = 'round'

  if (armed) {
    const recoil = Math.sin(t / 30) * 0.6
    ctx.beginPath()
    ctx.moveTo(11, -6 + breath)
    ctx.lineTo(38, -19 + breath + recoil)
    ctx.stroke()

    // 리볼버
    ctx.fillStyle = '#141418'
    ctx.fillRect(37, -24 + breath + recoil, 22, 7)
    ctx.beginPath()
    ctx.arc(39, -20 + breath + recoil, 5.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255, 200, 130, 0.65)'
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.moveTo(37, -24 + breath + recoil)
    ctx.lineTo(59, -24 + breath + recoil)
    ctx.stroke()
    return
  }

  if (reaching) {
    ctx.beginPath()
    ctx.moveTo(11, -4 + breath)
    ctx.quadraticCurveTo(20, 12, 15, 30)
    ctx.stroke()
    return
  }

  ctx.beginPath()
  ctx.moveTo(11, -2 + breath)
  ctx.quadraticCurveTo(16, 12, 11, 28)
  ctx.stroke()
}

/** 늦은 오후의 낮은 태양이 만드는 길게 늘어진 그림자 */
function drawLongShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  s: number,
  facingRight: boolean,
  fallT: number,
) {
  const dir = facingRight ? -1 : 1
  const len = (86 + fallT * 40) * s
  ctx.save()
  ctx.translate(x, groundY)
  ctx.transform(1, 0, dir * 0.75, 0.26, 0, 0)
  const g = ctx.createLinearGradient(0, 0, dir * len, 0)
  g.addColorStop(0, 'rgba(28, 12, 4, 0.55)')
  g.addColorStop(1, 'rgba(28, 12, 4, 0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.ellipse(dir * len * 0.4, 0, len * 0.5, 26 * s, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/* --------------------------------- 홀스터 --------------------------------- */

export interface HolsterOpts {
  cx: number
  top: number
  s: number
  /** 벨트가 화면 밖까지 뻗도록 하는 로컬 좌표 반폭 */
  spanHalf: number
  state: 'idle' | 'grip' | 'empty'
  hot: boolean
  t: number
}

export function drawHolster(ctx: CanvasRenderingContext2D, o: HolsterOpts) {
  const { cx, top, s, spanHalf, state, hot, t } = o
  ctx.save()
  ctx.translate(cx, top)
  ctx.scale(s, s)

  if (hot || state === 'grip') {
    const glow = ctx.createRadialGradient(0, 50, 10, 0, 50, 96)
    const strength = state === 'grip' ? 0.42 : 0.26
    glow.addColorStop(0, `rgba(255, 200, 90, ${strength})`)
    glow.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = glow
    ctx.fillRect(-104, -40, 208, 196)
  }

  drawGunBelt(ctx, spanHalf)

  const shake = state === 'grip' ? Math.sin(t / 55) * 1.2 : 0
  ctx.save()
  ctx.translate(shake, 0)

  const mouth = 18
  fillHolsterPouch(ctx, mouth, 'back')
  if (state !== 'empty') drawHolsteredRevolver(ctx, mouth, 'barrel')
  fillHolsterPouch(ctx, mouth, 'front')
  drawHolsterLeather(ctx, mouth, state === 'empty')
  if (state !== 'empty') drawHolsteredRevolver(ctx, mouth, 'exposed')

  if (state === 'grip') {
    drawGrippingHand(ctx, mouth - 6, t)
  }

  ctx.restore()
  ctx.restore()
}

function drawGunBelt(ctx: CanvasRenderingContext2D, spanHalf: number) {
  const belt = ctx.createLinearGradient(0, -2, 0, 26)
  belt.addColorStop(0, '#8a5530')
  belt.addColorStop(0.18, '#6a3c1c')
  belt.addColorStop(0.55, '#3d2410')
  belt.addColorStop(1, '#160c05')
  ctx.fillStyle = belt
  roundedPath(ctx, -spanHalf, 0, spanHalf * 2, 24, 3)
  ctx.fill()

  ctx.fillStyle = 'rgba(255, 200, 130, 0.28)'
  ctx.fillRect(-spanHalf, 1, spanHalf * 2, 2)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
  ctx.fillRect(-spanHalf, 21, spanHalf * 2, 3)

  ctx.strokeStyle = 'rgba(226, 196, 140, 0.38)'
  ctx.lineWidth = 1.1
  ctx.beginPath()
  ctx.moveTo(-spanHalf + 4, 5)
  ctx.lineTo(spanHalf - 4, 5)
  ctx.moveTo(-spanHalf + 4, 18)
  ctx.lineTo(spanHalf - 4, 18)
  ctx.stroke()

  const buckle = ctx.createLinearGradient(-82, -2, -50, 28)
  buckle.addColorStop(0, '#f6e08a')
  buckle.addColorStop(0.45, '#c9a23a')
  buckle.addColorStop(1, '#6a4e0c')
  ctx.fillStyle = buckle
  roundedPath(ctx, -80, -3, 28, 28, 4)
  ctx.fill()
  ctx.strokeStyle = '#3a2a08'
  ctx.lineWidth = 1.6
  ctx.stroke()
  ctx.fillStyle = '#2a1c08'
  roundedPath(ctx, -72, 5, 12, 12, 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255, 236, 170, 0.45)'
  ctx.fillRect(-78, -1, 22, 2)

  for (let i = 0; i < 6; i++) {
    const bx = 42 + i * 14
    ctx.fillStyle = '#24140a'
    roundedPath(ctx, bx - 5, 1, 10, 20, 2)
    ctx.fill()
    const brass = ctx.createLinearGradient(bx - 3, 2, bx + 3, 20)
    brass.addColorStop(0, '#f0d060')
    brass.addColorStop(0.4, '#c9a028')
    brass.addColorStop(1, '#6a4a10')
    ctx.fillStyle = brass
    ctx.beginPath()
    ctx.ellipse(bx, 5, 3.6, 3.1, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillRect(bx - 3.1, 6, 6.2, 12)
    ctx.fillStyle = 'rgba(255, 230, 150, 0.45)'
    ctx.fillRect(bx - 3.1, 6, 1.3, 12)
  }
}

function holsterPouchPath(ctx: CanvasRenderingContext2D, mouth: number) {
  ctx.beginPath()
  ctx.moveTo(-30, mouth)
  ctx.lineTo(28, mouth + 6)
  ctx.quadraticCurveTo(34, mouth + 18, 29, mouth + 40)
  ctx.quadraticCurveTo(24, mouth + 78, 4, mouth + 90)
  ctx.quadraticCurveTo(-16, mouth + 88, -24, mouth + 58)
  ctx.quadraticCurveTo(-34, mouth + 28, -30, mouth)
  ctx.closePath()
}

function fillHolsterPouch(
  ctx: CanvasRenderingContext2D,
  mouth: number,
  layer: 'back' | 'front',
) {
  const pouch = ctx.createLinearGradient(-34, mouth, 30, mouth + 40)
  if (layer === 'back') {
    pouch.addColorStop(0, '#1a0d06')
    pouch.addColorStop(1, '#3a2010')
  } else {
    pouch.addColorStop(0, '#2a160a')
    pouch.addColorStop(0.35, '#5a3216')
    pouch.addColorStop(0.7, '#8a4e22')
    pouch.addColorStop(1, '#c07834')
  }
  ctx.fillStyle = pouch
  holsterPouchPath(ctx, mouth)
  ctx.fill()
}

function drawHolsterLeather(ctx: CanvasRenderingContext2D, mouth: number, empty: boolean) {
  ctx.strokeStyle = '#120804'
  ctx.lineWidth = 2.2
  holsterPouchPath(ctx, mouth)
  ctx.stroke()

  ctx.strokeStyle = 'rgba(232, 200, 140, 0.42)'
  ctx.lineWidth = 1.15
  ctx.setLineDash([2.2, 3.4])
  ctx.beginPath()
  ctx.moveTo(-24, mouth + 10)
  ctx.quadraticCurveTo(-26, mouth + 40, -16, mouth + 72)
  ctx.moveTo(22, mouth + 14)
  ctx.quadraticCurveTo(22, mouth + 44, 8, mouth + 78)
  ctx.stroke()
  ctx.setLineDash([])

  ctx.fillStyle = 'rgba(255, 190, 110, 0.1)'
  ctx.beginPath()
  ctx.moveTo(8, mouth + 12)
  ctx.quadraticCurveTo(22, mouth + 30, 16, mouth + 62)
  ctx.quadraticCurveTo(10, mouth + 40, 8, mouth + 12)
  ctx.fill()

  ctx.fillStyle = empty ? 'rgba(6, 3, 1, 0.92)' : 'rgba(10, 5, 2, 0.22)'
  ctx.beginPath()
  ctx.ellipse(-1, mouth + 5, 26, 6, 0.12, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#4a2812'
  ctx.beginPath()
  ctx.moveTo(-32, mouth + 34)
  ctx.lineTo(30, mouth + 40)
  ctx.lineTo(29, mouth + 52)
  ctx.lineTo(-31, mouth + 46)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#140804'
  ctx.lineWidth = 1.3
  ctx.stroke()
  ctx.fillStyle = 'rgba(255, 200, 120, 0.2)'
  ctx.fillRect(-30, mouth + 35, 58, 1.5)

  const snap = ctx.createRadialGradient(18, mouth + 44, 1, 18, mouth + 44, 5)
  snap.addColorStop(0, '#f0d070')
  snap.addColorStop(0.55, '#b88820')
  snap.addColorStop(1, '#4a3408')
  ctx.fillStyle = snap
  ctx.beginPath()
  ctx.arc(18, mouth + 44, 4.4, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#c9a028'
  ctx.beginPath()
  ctx.arc(-22, mouth + 16, 2.4, 0, Math.PI * 2)
  ctx.arc(20, mouth + 20, 2.4, 0, Math.PI * 2)
  ctx.arc(-8, mouth + 78, 2.2, 0, Math.PI * 2)
  ctx.fill()
}

/** 피스키퍼 — barrel은 가죽 아래, exposed는 입구 위로 */
function drawHolsteredRevolver(
  ctx: CanvasRenderingContext2D,
  mouth: number,
  layer: 'barrel' | 'exposed',
) {
  ctx.save()
  ctx.translate(2, mouth + 1)
  ctx.rotate(0.42)

  if (layer === 'barrel') {
    const barrel = ctx.createLinearGradient(-5, 8, 6, 8)
    barrel.addColorStop(0, '#4a4a54')
    barrel.addColorStop(0.5, '#1c1c24')
    barrel.addColorStop(1, '#08080c')
    ctx.fillStyle = barrel
    roundedPath(ctx, -5, 10, 10, 50, 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(220, 220, 230, 0.3)'
    ctx.fillRect(-4, 12, 1.5, 46)
    ctx.restore()
    return
  }

  const cyl = ctx.createLinearGradient(-12, 6, 12, 22)
  cyl.addColorStop(0, '#7a7a84')
  cyl.addColorStop(0.45, '#303038')
  cyl.addColorStop(1, '#101014')
  ctx.fillStyle = cyl
  ctx.beginPath()
  ctx.ellipse(0, 12, 12, 10, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(210, 200, 170, 0.55)'
  ctx.lineWidth = 1.3
  ctx.stroke()
  ctx.fillStyle = '#07070a'
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - 0.5
    ctx.beginPath()
    ctx.arc(Math.cos(a) * 6.6, 12 + Math.sin(a) * 5.6, 1.85, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.fillStyle = '#2a2a32'
  ctx.beginPath()
  ctx.moveTo(-10, 0)
  ctx.lineTo(10, -2)
  ctx.lineTo(9, 6)
  ctx.lineTo(-11, 8)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = 'rgba(235, 215, 165, 0.4)'
  ctx.fillRect(-9, -1, 18, 1.5)

  ctx.fillStyle = '#1a1a22'
  ctx.beginPath()
  ctx.moveTo(-8, -2)
  ctx.lineTo(-14, -14)
  ctx.lineTo(-6, -16)
  ctx.lineTo(2, -4)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(210, 200, 180, 0.45)'
  ctx.lineWidth = 1
  ctx.stroke()

  ctx.strokeStyle = '#1a1a20'
  ctx.lineWidth = 2.4
  ctx.beginPath()
  ctx.arc(-2, 18, 7, 0.2, Math.PI - 0.15)
  ctx.stroke()

  const wood = ctx.createLinearGradient(-8, -4, -22, -32)
  wood.addColorStop(0, '#e8a858')
  wood.addColorStop(0.4, '#9a5420')
  wood.addColorStop(1, '#3c1c08')
  ctx.fillStyle = wood
  ctx.beginPath()
  ctx.moveTo(-8, 4)
  ctx.quadraticCurveTo(-6, -8, -10, -20)
  ctx.quadraticCurveTo(-16, -38, -26, -36)
  ctx.quadraticCurveTo(-32, -24, -22, -10)
  ctx.quadraticCurveTo(-14, 6, -4, 8)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#2a1408'
  ctx.lineWidth = 1.5
  ctx.stroke()

  ctx.strokeStyle = 'rgba(50, 24, 8, 0.5)'
  ctx.lineWidth = 0.85
  for (let i = 0; i < 5; i++) {
    ctx.beginPath()
    ctx.moveTo(-10 - i, -4 - i * 4)
    ctx.quadraticCurveTo(-16 - i, -14 - i * 3, -24, -22 - i * 2)
    ctx.stroke()
  }
  ctx.strokeStyle = 'rgba(255, 220, 150, 0.45)'
  ctx.lineWidth = 1.25
  ctx.beginPath()
  ctx.moveTo(-8, 0)
  ctx.quadraticCurveTo(-12, -16, -24, -32)
  ctx.stroke()

  ctx.fillStyle = '#2c2c34'
  ctx.beginPath()
  ctx.arc(-8, 2, 2.3, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

function drawGrippingHand(ctx: CanvasRenderingContext2D, pt: number, t: number) {
  const hx = -6 + Math.sin(t / 50) * 1.4
  const hy = pt + 2
  ctx.fillStyle = '#3a2414'
  roundedPath(ctx, hx - 16, hy - 6, 32, 26, 8)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255, 200, 130, 0.5)'
  ctx.lineWidth = 1.4
  ctx.stroke()
  ctx.fillStyle = '#31200f'
  for (let i = 0; i < 4; i++) {
    roundedPath(ctx, hx - 14 + i * 8, hy + 12, 7, 10, 3)
    ctx.fill()
  }
  ctx.fillStyle = '#2a1b0c'
  ctx.fillRect(hx - 10, hy - 18, 20, 14)
  ctx.fillStyle = 'rgba(255, 190, 120, 0.3)'
  ctx.fillRect(hx + 8, hy - 18, 2, 14)
}

/* --------------------------------- 분위기 --------------------------------- */

export function drawVultures(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
) {
  ctx.strokeStyle = 'rgba(26, 12, 8, 0.55)'
  ctx.lineWidth = 1.6
  for (let i = 0; i < 3; i++) {
    const a = t / (5200 + i * 900) + i * 2.1
    const cx = w * (0.3 + i * 0.2) + Math.cos(a) * w * 0.14
    const cy = h * (0.12 + i * 0.045) + Math.sin(a) * h * 0.03
    const flap = Math.sin(t / 340 + i) * 3.2
    const sp = 7 - i * 1.2
    ctx.beginPath()
    ctx.moveTo(cx - sp, cy + flap)
    ctx.quadraticCurveTo(cx - sp * 0.4, cy - 2.5, cx, cy)
    ctx.quadraticCurveTo(cx + sp * 0.4, cy - 2.5, cx + sp, cy + flap)
    ctx.stroke()
  }
}

export function drawTumbleweed(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  horizon: number,
  t: number,
) {
  const cycle = 11000
  const p = ((t % cycle) / cycle) * 1.25 - 0.15
  if (p < 0 || p > 1) return

  const x = p * w
  const groundY = horizon + (h - horizon) * 0.42
  const r = 9 + Math.sin(p * Math.PI) * 3
  const bounce = Math.abs(Math.sin(p * 26)) * 7

  ctx.save()
  ctx.translate(x, groundY - bounce)

  ctx.fillStyle = 'rgba(30, 14, 5, 0.3)'
  ctx.beginPath()
  ctx.ellipse(0, r + bounce * 0.6, r * 1.2, r * 0.28, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.rotate(p * 26)
  ctx.strokeStyle = 'rgba(146, 108, 52, 0.85)'
  ctx.lineWidth = 1.2
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r)
    ctx.lineTo(Math.cos(a + 2.1) * r * 0.85, Math.sin(a + 2.1) * r * 0.85)
    ctx.stroke()
  }
  ctx.restore()
}

let grainTile: HTMLCanvasElement | null = null

/** 필름 그레인 타일. 매 프레임 새로 만들면 비싸므로 한 번만 굽는다. */
function getGrain() {
  if (grainTile) return grainTile
  const size = 96
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const g = c.getContext('2d')
  if (g) {
    const img = g.createImageData(size, size)
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255
      img.data[i] = v
      img.data[i + 1] = v
      img.data[i + 2] = v
      img.data[i + 3] = 26
    }
    g.putImageData(img, 0, 0)
  }
  grainTile = c
  return c
}

const patternCache = new WeakMap<CanvasRenderingContext2D, CanvasPattern | null>()

export function drawGrain(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  strength = 1,
) {
  let pattern = patternCache.get(ctx)
  if (pattern === undefined) {
    const tile = getGrain()
    pattern = ctx.createPattern(tile, 'repeat')
    patternCache.set(ctx, pattern)
  }
  if (!pattern) return

  ctx.save()
  ctx.globalAlpha = 0.5 * strength
  ctx.globalCompositeOperation = 'overlay'
  ctx.translate(-Math.random() * 96, -Math.random() * 96)
  ctx.fillStyle = pattern
  ctx.fillRect(0, 0, w + 96, h + 96)
  ctx.restore()
}
