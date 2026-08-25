/**
 * 결투 배경 렌더러.
 *
 * 배경은 매 프레임 바뀌지 않으므로 오프스크린 캔버스에 한 번 그려두고 재사용한다.
 * 덕분에 산맥·마을·자갈 같은 디테일을 프레임 예산 걱정 없이 쌓을 수 있다.
 */

export interface SceneGeometry {
  w: number
  h: number
  horizon: number
  sunX: number
  sunY: number
  sunR: number
}

/** 결정적 난수. 프레임마다 자갈이 춤추지 않게 하려면 필수다. */
function mulberry32(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function geometryOf(w: number, h: number): SceneGeometry {
  const horizon = h * 0.55
  const sunR = h * 0.115
  return {
    w,
    h,
    horizon,
    sunX: w * 0.5,
    sunY: horizon - sunR * 0.35,
    sunR,
  }
}

let cached: { key: string; canvas: HTMLCanvasElement } | null = null

export function getBackdrop(w: number, h: number, dpr: number, seed: number) {
  const key = `${w}x${h}@${dpr}#${seed}`
  if (cached?.key === key) return cached.canvas

  const canvas = document.createElement('canvas')
  canvas.width = Math.floor(w * dpr)
  canvas.height = Math.floor(h * dpr)
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    paintBackdrop(ctx, geometryOf(w, h), mulberry32(seed * 9176 + 17))
  }
  cached = { key, canvas }
  return canvas
}

/* ------------------------------- 배경 페인팅 ------------------------------- */

function paintBackdrop(
  ctx: CanvasRenderingContext2D,
  g: SceneGeometry,
  rng: () => number,
) {
  paintSky(ctx, g)
  paintSun(ctx, g)
  paintClouds(ctx, g, rng)
  paintRidge(ctx, g, rng, 0.86, '#7d4436', g.horizon - g.h * 0.07, g.h * 0.075)
  paintRidge(ctx, g, rng, 0.95, '#4f2723', g.horizon - g.h * 0.028, g.h * 0.06)
  paintGround(ctx, g)
  paintTown(ctx, g, rng)
  paintProps(ctx, g, rng)
}

function paintSky(ctx: CanvasRenderingContext2D, g: SceneGeometry) {
  const sky = ctx.createLinearGradient(0, 0, 0, g.horizon)
  sky.addColorStop(0, '#150f24')
  sky.addColorStop(0.2, '#3a1b34')
  sky.addColorStop(0.42, '#7c2f2b')
  sky.addColorStop(0.62, '#c05a24')
  sky.addColorStop(0.82, '#e88a30')
  sky.addColorStop(1, '#f8ce77')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, g.w, g.horizon + 1)
}

function paintSun(ctx: CanvasRenderingContext2D, g: SceneGeometry) {
  const { sunX, sunY, sunR, h } = g

  const halo = ctx.createRadialGradient(sunX, sunY, sunR * 0.4, sunX, sunY, sunR * 5)
  halo.addColorStop(0, 'rgba(255, 214, 130, 0.55)')
  halo.addColorStop(0.35, 'rgba(255, 150, 60, 0.22)')
  halo.addColorStop(1, 'rgba(255, 120, 40, 0)')
  ctx.fillStyle = halo
  ctx.fillRect(sunX - sunR * 5, sunY - sunR * 5, sunR * 10, sunR * 10)

  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, g.w, g.horizon)
  ctx.clip()

  const disc = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR)
  disc.addColorStop(0, '#fff6dc')
  disc.addColorStop(0.55, '#ffd987')
  disc.addColorStop(1, '#f6a63f')
  ctx.fillStyle = disc
  ctx.beginPath()
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2)
  ctx.fill()

  // 서부극 특유의 태양 띠. 아래쪽으로 갈수록 촘촘해진다.
  ctx.globalCompositeOperation = 'multiply'
  for (let i = 0; i < 7; i++) {
    const p = i / 7
    const y = sunY + sunR * (0.1 + p * 0.95)
    const band = 2 + (1 - p) * 3
    ctx.fillStyle = `rgba(200, 90, 30, ${0.16 + p * 0.2})`
    ctx.fillRect(sunX - sunR * 1.2, y, sunR * 2.4, band)
  }
  ctx.restore()

  // 지평선 열기
  const haze = ctx.createLinearGradient(0, g.horizon - h * 0.06, 0, g.horizon)
  haze.addColorStop(0, 'rgba(255, 190, 110, 0)')
  haze.addColorStop(1, 'rgba(255, 205, 130, 0.5)')
  ctx.fillStyle = haze
  ctx.fillRect(0, g.horizon - h * 0.06, g.w, h * 0.06)
}

function paintClouds(
  ctx: CanvasRenderingContext2D,
  g: SceneGeometry,
  rng: () => number,
) {
  for (let i = 0; i < 9; i++) {
    const cy = g.horizon * (0.1 + rng() * 0.62)
    const cx = rng() * g.w
    const cw = g.w * (0.1 + rng() * 0.22)
    const ch = 3 + rng() * 8
    const lit = 1 - cy / g.horizon

    ctx.fillStyle = `rgba(90, 40, 45, ${0.3 + lit * 0.25})`
    ctx.beginPath()
    ctx.ellipse(cx, cy, cw, ch, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = `rgba(255, 180, 110, ${0.18 + lit * 0.3})`
    ctx.beginPath()
    ctx.ellipse(cx + cw * 0.1, cy + ch * 0.7, cw * 0.8, ch * 0.35, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** 톱니 능선 한 겹. alpha가 낮을수록 멀리 있는 산이다. */
function paintRidge(
  ctx: CanvasRenderingContext2D,
  g: SceneGeometry,
  rng: () => number,
  alpha: number,
  color: string,
  baseY: number,
  amp: number,
) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(0, baseY + amp)

  const step = g.w / 14
  for (let x = 0; x <= g.w + step; x += step) {
    const isMesa = rng() > 0.72
    if (isMesa) {
      const top = baseY - amp * (0.7 + rng() * 0.9)
      ctx.lineTo(x, top)
      ctx.lineTo(x + step * 0.7, top)
    } else {
      ctx.lineTo(x, baseY - amp * rng() * 0.7)
    }
  }
  ctx.lineTo(g.w, baseY + amp)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function paintGround(ctx: CanvasRenderingContext2D, g: SceneGeometry) {
  const { w, h, horizon } = g

  const dirt = ctx.createLinearGradient(0, horizon, 0, h)
  dirt.addColorStop(0, '#c07f42')
  dirt.addColorStop(0.16, '#8a5429')
  dirt.addColorStop(0.5, '#54301a')
  dirt.addColorStop(0.8, '#2b150a')
  dirt.addColorStop(1, '#150a04')
  ctx.fillStyle = dirt
  ctx.fillRect(0, horizon, w, h - horizon)

  // 소실점으로 모이는 흙길
  ctx.fillStyle = 'rgba(228, 174, 106, 0.16)'
  ctx.beginPath()
  ctx.moveTo(g.sunX - w * 0.045, horizon)
  ctx.lineTo(g.sunX + w * 0.045, horizon)
  ctx.lineTo(g.sunX + w * 0.42, h)
  ctx.lineTo(g.sunX - w * 0.42, h)
  ctx.closePath()
  ctx.fill()

  // 마차 바퀴 자국
  ctx.strokeStyle = 'rgba(58, 30, 12, 0.4)'
  for (const dir of [-1, 1]) {
    for (const off of [0.07, 0.12]) {
      ctx.beginPath()
      ctx.moveTo(g.sunX + dir * w * 0.012, horizon + 2)
      ctx.quadraticCurveTo(
        g.sunX + dir * w * off * 1.4,
        horizon + (h - horizon) * 0.5,
        g.sunX + dir * w * off * 3.2,
        h,
      )
      ctx.lineWidth = 1 + off * 12
      ctx.stroke()
    }
  }

  // 화면 아래를 눌러 전경 홀스터가 어둠 속에서 도드라지게 한다
  const foot = ctx.createLinearGradient(0, h * 0.72, 0, h)
  foot.addColorStop(0, 'rgba(10, 5, 2, 0)')
  foot.addColorStop(1, 'rgba(10, 5, 2, 0.72)')
  ctx.fillStyle = foot
  ctx.fillRect(0, h * 0.72, w, h * 0.28)
}

function paintTown(ctx: CanvasRenderingContext2D, g: SceneGeometry, rng: () => number) {
  const { w, horizon } = g
  const baseY = horizon + g.h * 0.035

  // 왼쪽 블록
  drawBuilding(ctx, rng, w * 0.03, baseY, w * 0.13, g.h * 0.2, 'SALOON')
  drawBuilding(ctx, rng, w * 0.155, baseY - 2, w * 0.09, g.h * 0.15, null)
  drawWindmill(ctx, w * 0.26, baseY - g.h * 0.15, g.h * 0.16)

  // 오른쪽 블록
  drawBuilding(ctx, rng, w * 0.84, baseY, w * 0.13, g.h * 0.19, 'HOTEL')
  drawBuilding(ctx, rng, w * 0.75, baseY - 2, w * 0.09, g.h * 0.14, null)
  drawWaterTower(ctx, w * 0.71, baseY - g.h * 0.14, g.h * 0.13)
}

function drawBuilding(
  ctx: CanvasRenderingContext2D,
  rng: () => number,
  x: number,
  groundY: number,
  bw: number,
  bh: number,
  sign: string | null,
) {
  const top = groundY - bh

  ctx.fillStyle = '#2b1a12'
  ctx.fillRect(x, top, bw, bh)

  // 가짜 정면 파라펫
  ctx.fillStyle = '#332015'
  ctx.beginPath()
  ctx.moveTo(x - 2, top)
  ctx.lineTo(x + bw / 2, top - bh * 0.12)
  ctx.lineTo(x + bw + 2, top)
  ctx.closePath()
  ctx.fill()

  // 지는 해를 받는 처마 하이라이트
  ctx.fillStyle = 'rgba(255, 170, 90, 0.22)'
  ctx.fillRect(x, top, bw, 2.5)

  // 창문 — 일부는 등불이 켜져 있다
  const cols = Math.max(2, Math.round(bw / 18))
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < cols; c++) {
      const wx = x + bw * ((c + 0.5) / cols) - 4
      const wy = top + bh * (0.22 + r * 0.3)
      ctx.fillStyle = rng() > 0.6 ? 'rgba(255, 190, 90, 0.75)' : 'rgba(12, 6, 3, 0.85)'
      ctx.fillRect(wx, wy, 8, bh * 0.14)
    }
  }

  // 포치 차양
  ctx.fillStyle = '#1c110a'
  ctx.fillRect(x - 4, groundY - bh * 0.3, bw + 8, 4)
  for (let i = 0; i <= 3; i++) {
    ctx.fillRect(x + (bw / 3) * i - 1, groundY - bh * 0.3, 2, bh * 0.3)
  }

  if (sign) {
    ctx.fillStyle = 'rgba(240, 210, 150, 0.6)'
    ctx.font = `700 ${Math.max(7, Math.round(bw / 9))}px "Paperlogy", "Special Elite", monospace`
    ctx.textAlign = 'center'
    ctx.fillText(sign, x + bw / 2, top + bh * 0.14)
  }
}

function drawWindmill(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.strokeStyle = '#241610'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x - s * 0.12, y + s)
  ctx.lineTo(x, y)
  ctx.lineTo(x + s * 0.12, y + s)
  ctx.stroke()

  ctx.fillStyle = '#241610'
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + Math.cos(a) * s * 0.3, y + Math.sin(a) * s * 0.3)
    ctx.lineTo(x + Math.cos(a + 0.5) * s * 0.28, y + Math.sin(a + 0.5) * s * 0.28)
    ctx.closePath()
    ctx.fill()
  }
}

function drawWaterTower(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.fillStyle = '#241610'
  ctx.beginPath()
  ctx.moveTo(x - s * 0.3, y)
  ctx.lineTo(x + s * 0.3, y)
  ctx.lineTo(x + s * 0.26, y + s * 0.5)
  ctx.lineTo(x - s * 0.26, y + s * 0.5)
  ctx.closePath()
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(x - s * 0.32, y)
  ctx.lineTo(x, y - s * 0.22)
  ctx.lineTo(x + s * 0.32, y)
  ctx.closePath()
  ctx.fill()

  ctx.strokeStyle = '#241610'
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.moveTo(x - s * 0.2, y + s * 0.5)
  ctx.lineTo(x - s * 0.3, y + s)
  ctx.moveTo(x + s * 0.2, y + s * 0.5)
  ctx.lineTo(x + s * 0.3, y + s)
  ctx.stroke()

  ctx.fillStyle = 'rgba(255, 170, 90, 0.2)'
  ctx.fillRect(x - s * 0.3, y, s * 0.6, 2)
}

function paintProps(ctx: CanvasRenderingContext2D, g: SceneGeometry, rng: () => number) {
  const { w, h, horizon } = g

  drawCactus(ctx, w * 0.075, horizon + h * 0.13, h * 0.15)
  drawCactus(ctx, w * 0.93, horizon + h * 0.18, h * 0.19)
  drawCactus(ctx, w * 0.35, horizon + h * 0.04, h * 0.06)

  // 자갈과 마른 풀. 아래로 갈수록 커져 원근을 만든다.
  for (let i = 0; i < 90; i++) {
    const p = rng()
    const y = horizon + (h - horizon) * (p * p)
    const x = rng() * w
    const depth = (y - horizon) / (h - horizon)
    const size = 1 + depth * 4

    if (rng() > 0.42) {
      ctx.fillStyle = `rgba(48, 26, 12, ${0.25 + depth * 0.4})`
      ctx.beginPath()
      ctx.ellipse(x, y, size, size * 0.6, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = `rgba(255, 190, 120, ${0.12 + depth * 0.18})`
      ctx.fillRect(x - size, y - size * 0.6, size * 2, 1)
    } else {
      ctx.strokeStyle = `rgba(120, 92, 44, ${0.3 + depth * 0.35})`
      ctx.lineWidth = 1
      for (let b = 0; b < 3; b++) {
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x + (b - 1) * size * 1.6, y - size * 2.4)
        ctx.stroke()
      }
    }
  }

  // 지평선 주변만 뿌옇게 눌러 인물이 앞으로 튀어나오게 한다
  const depthHaze = ctx.createLinearGradient(0, horizon - h * 0.05, 0, horizon + h * 0.14)
  depthHaze.addColorStop(0, 'rgba(255, 176, 100, 0.32)')
  depthHaze.addColorStop(1, 'rgba(255, 150, 70, 0)')
  ctx.fillStyle = depthHaze
  ctx.fillRect(0, horizon - h * 0.05, w, h * 0.2)
}

/** height는 지면에서 선인장 머리까지의 픽셀 높이다. */
function drawCactus(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  height: number,
) {
  const trunk = Math.max(3, height * 0.17)
  ctx.save()
  ctx.strokeStyle = '#1c2413'
  ctx.lineCap = 'round'
  ctx.lineWidth = trunk
  ctx.beginPath()
  ctx.moveTo(x, groundY)
  ctx.lineTo(x, groundY - height)
  ctx.stroke()

  ctx.lineWidth = trunk * 0.7
  ctx.beginPath()
  ctx.moveTo(x, groundY - height * 0.55)
  ctx.lineTo(x - height * 0.3, groundY - height * 0.55)
  ctx.lineTo(x - height * 0.3, groundY - height * 0.8)
  ctx.moveTo(x, groundY - height * 0.42)
  ctx.lineTo(x + height * 0.26, groundY - height * 0.42)
  ctx.lineTo(x + height * 0.26, groundY - height * 0.66)
  ctx.stroke()

  // 태양 쪽 윤곽을 스치는 빛
  ctx.strokeStyle = 'rgba(255, 186, 108, 0.4)'
  ctx.lineWidth = Math.max(1, trunk * 0.2)
  ctx.beginPath()
  ctx.moveTo(x + trunk * 0.36, groundY - trunk * 0.5)
  ctx.lineTo(x + trunk * 0.36, groundY - height + trunk * 0.3)
  ctx.stroke()
  ctx.restore()
}
