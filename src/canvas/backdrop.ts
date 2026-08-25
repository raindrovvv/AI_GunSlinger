/**
 * 결투 및 대치 화면을 위한 9대 서부 테마 배경 렌더러.
 *
 * 라운드마다 완전히 다른 시각적 경험을 제공하는 9가지 테마:
 * 1. 더스트 타운의 정오 (High Noon Town)
 * 2. 붉은 협곡과 메사 (Red Canyon & Mesa)
 * 3. 버려진 황금 폐광촌 (Ghost Mine Ruin)
 * 4. 대륙 횡단 철도 교차로 (Iron Rail Crossing)
 * 5. 핏빛 석양과 모래 언덕 (Crimson Dune Desert)
 * 6. 폭풍우 몰아치는 황무지 (Thunderstorm Badlands)
 * 7. 황혼의 카우보이 야영지 (Twilight Campfire)
 * 8. 달빛 내리는 공동묘지 (Midnight Boot Hill)
 * 9. 사신의 붉은 개기일식 (Blood Eclipse Final Arena)
 */

export interface SceneGeometry {
  w: number
  h: number
  horizon: number
  sunX: number
  sunY: number
  sunR: number
}

export interface ThemeInfo {
  round: number
  name: string
  subtitle: string
  skyType: 'day' | 'sunset' | 'dust' | 'rail' | 'crimson' | 'storm' | 'twilight' | 'night' | 'eclipse'
}

export const THEME_LIST: ThemeInfo[] = [
  { round: 1, name: '더스트 타운', subtitle: '작열하는 정오의 메인 스트리트', skyType: 'day' },
  { round: 2, name: '붉은 협곡', subtitle: '사암 절벽과 웅장한 메사 밸리', skyType: 'sunset' },
  { round: 3, name: '유령 폐광촌', subtitle: '금광 붐이 멈춘 먼지투성이 유적', skyType: 'dust' },
  { round: 4, name: '철도 교차로', subtitle: '대륙 횡단 열차가 가르는 대평원', skyType: 'rail' },
  { round: 5, name: '핏빛 사막', subtitle: '붉은 모래 언덕과 천연 아치 바위', skyType: 'crimson' },
  { round: 6, name: '뇌우의 황무지', subtitle: '먹구름과 번개가 내리꽂히는 폐허', skyType: 'storm' },
  { round: 7, name: '황혼의 야영지', subtitle: '모닥불과 별빛이 수놓인 대초원', skyType: 'twilight' },
  { round: 8, name: '부트힐 묘지', subtitle: '차가운 달빛이 비추는 묘비의 언덕', skyType: 'night' },
  { round: 9, name: '사신의 결전장', subtitle: '하늘을 삼킨 붉은 개기일식', skyType: 'eclipse' },
]

export function getThemeInfo(round: number): ThemeInfo {
  const idx = Math.max(0, Math.min(THEME_LIST.length - 1, (round - 1) % THEME_LIST.length))
  return THEME_LIST[idx]
}

/** 결정적 난수 (Deterministic RNG) */
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

const cache = new Map<string, HTMLCanvasElement>()

export function getBackdrop(w: number, h: number, dpr: number, round: number) {
  const key = `${w}x${h}@${dpr}#r${round}`
  const existing = cache.get(key)
  if (existing) return existing

  const canvas = document.createElement('canvas')
  canvas.width = Math.floor(w * dpr)
  canvas.height = Math.floor(h * dpr)
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const theme = getThemeInfo(round)
    paintBackdrop(ctx, geometryOf(w, h), mulberry32(round * 9176 + 17), theme)
  }
  cache.set(key, canvas)
  return canvas
}

/* ==========================================================================
   메인 배경 페인팅 분기
   ========================================================================== */

function paintBackdrop(
  ctx: CanvasRenderingContext2D,
  g: SceneGeometry,
  rng: () => number,
  theme: ThemeInfo,
) {
  paintSky(ctx, g, theme)
  paintCelestial(ctx, g, rng, theme)
  paintCloudsOrStars(ctx, g, rng, theme)
  paintMountains(ctx, g, rng, theme)
  paintGround(ctx, g, theme)
  paintStructures(ctx, g, rng, theme)
  paintProps(ctx, g, rng, theme)
}

/* ==========================================================================
   1. 하늘 그라데이션 (Sky Gradients)
   ========================================================================== */

function paintSky(ctx: CanvasRenderingContext2D, g: SceneGeometry, theme: ThemeInfo) {
  const sky = ctx.createLinearGradient(0, 0, 0, g.horizon)

  switch (theme.skyType) {
    case 'day': // R1: 대낮의 작열하는 정오 하늘
      sky.addColorStop(0, '#12263a')
      sky.addColorStop(0.25, '#204d6e')
      sky.addColorStop(0.55, '#5d8296')
      sky.addColorStop(0.8, '#b8996e')
      sky.addColorStop(1, '#fde6b0')
      break

    case 'sunset': // R2: 붉은 협곡의 석양
      sky.addColorStop(0, '#1c0a12')
      sky.addColorStop(0.25, '#4a171c')
      sky.addColorStop(0.5, '#9e3223')
      sky.addColorStop(0.75, '#db6226')
      sky.addColorStop(1, '#fca448')
      break

    case 'dust': // R3: 유령 폐광의 황록빛 먼지 구름
      sky.addColorStop(0, '#141410')
      sky.addColorStop(0.3, '#302c20')
      sky.addColorStop(0.6, '#6b5e3c')
      sky.addColorStop(0.85, '#ad975c')
      sky.addColorStop(1, '#e3cb88')
      break

    case 'rail': // R4: 철도 교차로의 청동빛 황혼
      sky.addColorStop(0, '#101524')
      sky.addColorStop(0.28, '#2d2d48')
      sky.addColorStop(0.58, '#70424a')
      sky.addColorStop(0.82, '#b8663d')
      sky.addColorStop(1, '#f0a359')
      break

    case 'crimson': // R5: 핏빛 석양의 사막
      sky.addColorStop(0, '#1f0416')
      sky.addColorStop(0.25, '#590a28')
      sky.addColorStop(0.5, '#b0162a')
      sky.addColorStop(0.75, '#eb4820')
      sky.addColorStop(1, '#ffc05e')
      break

    case 'storm': // R6: 폭풍우와 뇌운
      sky.addColorStop(0, '#060810')
      sky.addColorStop(0.3, '#141426')
      sky.addColorStop(0.65, '#2e263c')
      sky.addColorStop(0.88, '#463c4e')
      sky.addColorStop(1, '#5e5466')
      break

    case 'twilight': // R7: 황혼의 보랏빛 초원
      sky.addColorStop(0, '#080c20')
      sky.addColorStop(0.3, '#1a193d')
      sky.addColorStop(0.6, '#462b4c')
      sky.addColorStop(0.82, '#944b58')
      sky.addColorStop(1, '#e4886b')
      break

    case 'night': // R8: 달빛 내리는 한밤의 부트힐
      sky.addColorStop(0, '#02040a')
      sky.addColorStop(0.35, '#06101c')
      sky.addColorStop(0.7, '#0e2236')
      sky.addColorStop(1, '#1b384e')
      break

    case 'eclipse': // R9: 사신의 붉은 개기일식
      sky.addColorStop(0, '#040003')
      sky.addColorStop(0.25, '#1e0207')
      sky.addColorStop(0.55, '#52060c')
      sky.addColorStop(0.82, '#9c0d16')
      sky.addColorStop(1, '#ff2e18')
      break
  }

  ctx.fillStyle = sky
  ctx.fillRect(0, 0, g.w, g.horizon + 1)
}

/* ==========================================================================
   2. 천체 (태양 / 달 / 개기일식 / 번개)
   ========================================================================== */

function paintCelestial(
  ctx: CanvasRenderingContext2D,
  g: SceneGeometry,
  rng: () => number,
  theme: ThemeInfo,
) {
  const { sunX, sunY, sunR, h, w, horizon } = g

  if (theme.skyType === 'storm') {
    // R6 번개 섬광 연출
    ctx.save()
    const lx = sunX + (rng() - 0.5) * w * 0.4
    const ly = horizon * 0.1

    // 번개 줄기
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2.4
    ctx.shadowColor = '#88aaff'
    ctx.shadowBlur = 14
    ctx.beginPath()
    ctx.moveTo(lx, ly)
    let curX = lx
    let curY = ly
    while (curY < horizon) {
      curX += (rng() - 0.5) * 24
      curY += 12 + rng() * 18
      ctx.lineTo(curX, curY)
    }
    ctx.stroke()

    // 뇌운 후광
    const flashHalo = ctx.createRadialGradient(lx, ly + 40, 10, lx, ly + 40, sunR * 4)
    flashHalo.addColorStop(0, 'rgba(210, 230, 255, 0.4)')
    flashHalo.addColorStop(1, 'rgba(100, 140, 255, 0)')
    ctx.fillStyle = flashHalo
    ctx.fillRect(0, 0, w, horizon)
    ctx.restore()
    return
  }

  if (theme.skyType === 'night') {
    // R8 보름달 (Full Moon with craters & halo)
    const moonX = sunX + w * 0.12
    const moonY = horizon * 0.38
    const moonR = sunR * 0.85

    // 달무리
    const halo = ctx.createRadialGradient(moonX, moonY, moonR * 0.5, moonX, moonY, moonR * 4.5)
    halo.addColorStop(0, 'rgba(190, 225, 255, 0.4)')
    halo.addColorStop(0.4, 'rgba(120, 170, 220, 0.15)')
    halo.addColorStop(1, 'rgba(30, 70, 120, 0)')
    ctx.fillStyle = halo
    ctx.fillRect(moonX - moonR * 5, moonY - moonR * 5, moonR * 10, moonR * 10)

    // 달 본체
    const moonDisc = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, moonR)
    moonDisc.addColorStop(0, '#ffffff')
    moonDisc.addColorStop(0.7, '#e4edfc')
    moonDisc.addColorStop(1, '#b6cced')
    ctx.fillStyle = moonDisc
    ctx.beginPath()
    ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2)
    ctx.fill()

    // 달 크레이터 음영
    ctx.fillStyle = 'rgba(120, 145, 180, 0.25)'
    ctx.beginPath()
    ctx.arc(moonX - moonR * 0.25, moonY - moonR * 0.2, moonR * 0.22, 0, Math.PI * 2)
    ctx.arc(moonX + moonR * 0.3, moonY + moonR * 0.15, moonR * 0.28, 0, Math.PI * 2)
    ctx.arc(moonX - moonR * 0.1, moonY + moonR * 0.35, moonR * 0.18, 0, Math.PI * 2)
    ctx.fill()
    return
  }

  if (theme.skyType === 'eclipse') {
    // R9 사신의 개기일식 (Black Sun with Crimson Corona Flare)
    const eX = sunX
    const eY = horizon - sunR * 0.4
    const eR = sunR * 1.05

    // 타오르는 붉은 코로나 광배
    const corona = ctx.createRadialGradient(eX, eY, eR * 0.8, eX, eY, eR * 5)
    corona.addColorStop(0, 'rgba(255, 60, 20, 0.95)')
    corona.addColorStop(0.25, 'rgba(230, 20, 20, 0.55)')
    corona.addColorStop(0.6, 'rgba(140, 0, 10, 0.25)')
    corona.addColorStop(1, 'rgba(50, 0, 0, 0)')
    ctx.fillStyle = corona
    ctx.fillRect(eX - eR * 5, eY - eR * 5, eR * 10, eR * 10)

    // 코로나 화염 스파이크
    ctx.save()
    ctx.strokeStyle = 'rgba(255, 90, 40, 0.6)'
    ctx.lineWidth = 2
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2
      const len = eR * (1.2 + (i % 3 === 0 ? 0.8 : 0.35))
      ctx.beginPath()
      ctx.moveTo(eX + Math.cos(a) * eR, eY + Math.sin(a) * eR)
      ctx.lineTo(eX + Math.cos(a) * len, eY + Math.sin(a) * len)
      ctx.stroke()
    }
    ctx.restore()

    // 칠흑의 태양 본체 (Black Sun)
    ctx.fillStyle = '#060002'
    ctx.beginPath()
    ctx.arc(eX, eY, eR, 0, Math.PI * 2)
    ctx.fill()

    // 일식 테두리 림 라이트
    ctx.strokeStyle = '#ff4422'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(eX, eY, eR, 0, Math.PI * 2)
    ctx.stroke()
    return
  }

  // 일반 태양 (Day, Sunset, Dust, Rail, Crimson, Twilight)
  const isCrimson = theme.skyType === 'crimson'
  const isDay = theme.skyType === 'day'
  const haloColor1 = isCrimson ? 'rgba(255, 90, 40, 0.6)' : isDay ? 'rgba(255, 240, 180, 0.65)' : 'rgba(255, 214, 130, 0.55)'
  const haloColor2 = isCrimson ? 'rgba(220, 40, 20, 0.25)' : isDay ? 'rgba(255, 190, 90, 0.25)' : 'rgba(255, 150, 60, 0.22)'

  const halo = ctx.createRadialGradient(sunX, sunY, sunR * 0.4, sunX, sunY, sunR * 5)
  halo.addColorStop(0, haloColor1)
  halo.addColorStop(0.35, haloColor2)
  halo.addColorStop(1, 'rgba(255, 120, 40, 0)')
  ctx.fillStyle = halo
  ctx.fillRect(sunX - sunR * 5, sunY - sunR * 5, sunR * 10, sunR * 10)

  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, w, horizon)
  ctx.clip()

  const disc = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR)
  if (isCrimson) {
    disc.addColorStop(0, '#ffe894')
    disc.addColorStop(0.45, '#ff5522')
    disc.addColorStop(1, '#b50f14')
  } else if (isDay) {
    disc.addColorStop(0, '#ffffff')
    disc.addColorStop(0.6, '#fff4cb')
    disc.addColorStop(1, '#fed476')
  } else {
    disc.addColorStop(0, '#fff6dc')
    disc.addColorStop(0.55, '#ffd987')
    disc.addColorStop(1, '#f6a63f')
  }
  ctx.fillStyle = disc
  ctx.beginPath()
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2)
  ctx.fill()

  // 서부극 특유의 수평 태양 띠
  ctx.globalCompositeOperation = 'multiply'
  for (let i = 0; i < 7; i++) {
    const p = i / 7
    const y = sunY + sunR * (0.1 + p * 0.95)
    const band = 2 + (1 - p) * 3
    ctx.fillStyle = `rgba(180, 70, 20, ${0.16 + p * 0.2})`
    ctx.fillRect(sunX - sunR * 1.2, y, sunR * 2.4, band)
  }
  ctx.restore()

  // 지평선 열기 헤이즈
  const haze = ctx.createLinearGradient(0, horizon - h * 0.06, 0, horizon)
  haze.addColorStop(0, 'rgba(255, 190, 110, 0)')
  haze.addColorStop(1, isCrimson ? 'rgba(255, 80, 40, 0.45)' : 'rgba(255, 205, 130, 0.5)')
  ctx.fillStyle = haze
  ctx.fillRect(0, horizon - h * 0.06, w, h * 0.06)
}

/* ==========================================================================
   3. 구름 & 별무리 (Clouds & Starfields)
   ========================================================================== */

function paintCloudsOrStars(
  ctx: CanvasRenderingContext2D,
  g: SceneGeometry,
  rng: () => number,
  theme: ThemeInfo,
) {
  if (theme.skyType === 'night' || theme.skyType === 'twilight' || theme.skyType === 'eclipse') {
    // 반짝이는 별무리 (Stars & Constellations)
    const starCount = theme.skyType === 'night' ? 70 : 40
    for (let i = 0; i < starCount; i++) {
      const sx = rng() * g.w
      const sy = rng() * (g.horizon * 0.75)
      const sr = 0.5 + rng() * 1.3
      const sa = 0.3 + rng() * 0.65
      ctx.fillStyle = theme.skyType === 'eclipse' ? `rgba(255, 160, 140, ${sa})` : `rgba(240, 248, 255, ${sa})`
      ctx.beginPath()
      ctx.arc(sx, sy, sr, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // 구름 페인팅
  const cloudColor1 =
    theme.skyType === 'storm'
      ? 'rgba(20, 18, 30, 0.7)'
      : theme.skyType === 'night'
        ? 'rgba(8, 20, 36, 0.4)'
        : theme.skyType === 'eclipse'
          ? 'rgba(40, 6, 10, 0.65)'
          : 'rgba(90, 40, 45, 0.35)'

  const cloudColor2 =
    theme.skyType === 'storm'
      ? 'rgba(80, 70, 95, 0.3)'
      : theme.skyType === 'night'
        ? 'rgba(60, 90, 130, 0.2)'
        : theme.skyType === 'eclipse'
          ? 'rgba(220, 50, 30, 0.35)'
          : 'rgba(255, 180, 110, 0.25)'

  for (let i = 0; i < 8; i++) {
    const cy = g.horizon * (0.1 + rng() * 0.6)
    const cx = rng() * g.w
    const cw = g.w * (0.12 + rng() * 0.24)
    const ch = 3 + rng() * 9

    ctx.fillStyle = cloudColor1
    ctx.beginPath()
    ctx.ellipse(cx, cy, cw, ch, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = cloudColor2
    ctx.beginPath()
    ctx.ellipse(cx + cw * 0.1, cy + ch * 0.6, cw * 0.8, ch * 0.35, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

/* ==========================================================================
   4. 원경 산맥 & 메사 절벽 (Mountains & Ridges)
   ========================================================================== */

function paintMountains(
  ctx: CanvasRenderingContext2D,
  g: SceneGeometry,
  rng: () => number,
  theme: ThemeInfo,
) {
  let r1Color = '#7d4436'
  let r2Color = '#4f2723'

  switch (theme.skyType) {
    case 'day':
      r1Color = '#805646'
      r2Color = '#523428'
      break
    case 'sunset': // 붉은 협곡
      r1Color = '#9e3a28'
      r2Color = '#631f16'
      break
    case 'dust': // 유령 폐광
      r1Color = '#6b5a42'
      r2Color = '#423624'
      break
    case 'rail': // 철도 평원
      r1Color = '#69484b'
      r2Color = '#3d282c'
      break
    case 'crimson': // 핏빛 사막 모래언덕
      r1Color = '#942220'
      r2Color = '#540f12'
      break
    case 'storm': // 뇌우 황무지
      r1Color = '#342f40'
      r2Color = '#1e1a26'
      break
    case 'twilight': // 황혼 초원
      r1Color = '#54364c'
      r2Color = '#2b1928'
      break
    case 'night': // 달빛 묘지
      r1Color = '#1e3044'
      r2Color = '#0f1c29'
      break
    case 'eclipse': // 사신의 붉은 일식
      r1Color = '#660a10'
      r2Color = '#2e0206'
      break
  }

  paintRidge(ctx, g, rng, 0.86, r1Color, g.horizon - g.h * 0.07, g.h * 0.075, theme.skyType === 'sunset' || theme.skyType === 'dust')
  paintRidge(ctx, g, rng, 0.95, r2Color, g.horizon - g.h * 0.028, g.h * 0.06, theme.skyType === 'sunset' || theme.skyType === 'dust')
}

function paintRidge(
  ctx: CanvasRenderingContext2D,
  g: SceneGeometry,
  rng: () => number,
  alpha: number,
  color: string,
  baseY: number,
  amp: number,
  heavyMesa = false,
) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(0, baseY + amp)

  const step = g.w / 14
  for (let x = 0; x <= g.w + step; x += step) {
    const isMesa = heavyMesa ? rng() > 0.45 : rng() > 0.72
    if (isMesa) {
      const top = baseY - amp * (0.75 + rng() * 0.85)
      ctx.lineTo(x, top)
      ctx.lineTo(x + step * 0.75, top)
    } else {
      ctx.lineTo(x, baseY - amp * rng() * 0.7)
    }
  }
  ctx.lineTo(g.w, baseY + amp)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

/* ==========================================================================
   5. 지형 및 바닥 (Ground, Sand, Rails, Puddles)
   ========================================================================== */

function paintGround(ctx: CanvasRenderingContext2D, g: SceneGeometry, theme: ThemeInfo) {
  const { w, h, horizon, sunX } = g

  const dirt = ctx.createLinearGradient(0, horizon, 0, h)
  switch (theme.skyType) {
    case 'day':
      dirt.addColorStop(0, '#c78f4a')
      dirt.addColorStop(0.2, '#915e2e')
      dirt.addColorStop(0.6, '#573418')
      dirt.addColorStop(1, '#241408')
      break
    case 'sunset':
      dirt.addColorStop(0, '#b84d30')
      dirt.addColorStop(0.2, '#7d2b18')
      dirt.addColorStop(0.6, '#47140b')
      dirt.addColorStop(1, '#1f0704')
      break
    case 'dust':
      dirt.addColorStop(0, '#9e8555')
      dirt.addColorStop(0.2, '#665230')
      dirt.addColorStop(0.6, '#3d2f19')
      dirt.addColorStop(1, '#1a1308')
      break
    case 'rail':
      dirt.addColorStop(0, '#a37152')
      dirt.addColorStop(0.2, '#6e452e')
      dirt.addColorStop(0.6, '#3d2315')
      dirt.addColorStop(1, '#1a0d07')
      break
    case 'crimson':
      dirt.addColorStop(0, '#b03426')
      dirt.addColorStop(0.2, '#751814')
      dirt.addColorStop(0.6, '#400a0d')
      dirt.addColorStop(1, '#170204')
      break
    case 'storm':
      dirt.addColorStop(0, '#54463d')
      dirt.addColorStop(0.2, '#362c26')
      dirt.addColorStop(0.6, '#1f1814')
      dirt.addColorStop(1, '#0d0a08')
      break
    case 'twilight':
      dirt.addColorStop(0, '#754e60')
      dirt.addColorStop(0.2, '#4a2c3a')
      dirt.addColorStop(0.6, '#29141f')
      dirt.addColorStop(1, '#12070d')
      break
    case 'night':
      dirt.addColorStop(0, '#2b3c4f')
      dirt.addColorStop(0.2, '#182433')
      dirt.addColorStop(0.6, '#0d151e')
      dirt.addColorStop(1, '#05080c')
      break
    case 'eclipse':
      dirt.addColorStop(0, '#590a12')
      dirt.addColorStop(0.2, '#38040a')
      dirt.addColorStop(0.6, '#1c0104')
      dirt.addColorStop(1, '#080001')
      break
  }

  ctx.fillStyle = dirt
  ctx.fillRect(0, horizon, w, h - horizon)

  if (theme.skyType === 'rail') {
    // 철도 레일 페인팅 (Perspective Railway Tracks)
    ctx.strokeStyle = 'rgba(210, 180, 150, 0.45)'
    ctx.lineWidth = 2.5
    // 좌우 침목 및 2줄의 강철 레일
    const rx1 = sunX - w * 0.02
    const rx2 = sunX + w * 0.02
    const rbx1 = sunX - w * 0.36
    const rbx2 = sunX + w * 0.36

    // 레일 선
    ctx.beginPath()
    ctx.moveTo(rx1, horizon)
    ctx.lineTo(rbx1, h)
    ctx.moveTo(rx2, horizon)
    ctx.lineTo(rbx2, h)
    ctx.stroke()

    // 침목 (Ties)
    ctx.strokeStyle = 'rgba(40, 20, 12, 0.6)'
    for (let i = 1; i <= 14; i++) {
      const p = i / 14
      const ty = horizon + (h - horizon) * (p * p)
      const tw = (rbx2 - rbx1) * (p * 0.95)
      ctx.lineWidth = 1.5 + p * 4
      ctx.beginPath()
      ctx.moveTo(sunX - tw / 2, ty)
      ctx.lineTo(sunX + tw / 2, ty)
      ctx.stroke()
    }
  } else {
    // 소실점으로 모이는 일반 황야 흙길
    ctx.fillStyle = theme.skyType === 'night' ? 'rgba(180, 210, 240, 0.08)' : 'rgba(228, 174, 106, 0.16)'
    ctx.beginPath()
    ctx.moveTo(sunX - w * 0.045, horizon)
    ctx.lineTo(sunX + w * 0.045, horizon)
    ctx.lineTo(sunX + w * 0.42, h)
    ctx.lineTo(sunX - w * 0.42, h)
    ctx.closePath()
    ctx.fill()
  }

  // 화면 하단 비네트 그라데이션
  const foot = ctx.createLinearGradient(0, h * 0.72, 0, h)
  foot.addColorStop(0, 'rgba(10, 5, 2, 0)')
  foot.addColorStop(1, 'rgba(10, 5, 2, 0.75)')
  ctx.fillStyle = foot
  ctx.fillRect(0, h * 0.72, w, h * 0.28)
}

/* ==========================================================================
   6. 테마별 건물 & 랜드마크 (Structures & Landmarks)
   ========================================================================== */

function paintStructures(
  ctx: CanvasRenderingContext2D,
  g: SceneGeometry,
  rng: () => number,
  theme: ThemeInfo,
) {
  const { w, horizon } = g
  const baseY = horizon + g.h * 0.035

  switch (theme.skyType) {
    case 'day': // R1: 더스트 타운 살롱, 호텔, 풍차, 물탱크
      drawBuilding(ctx, rng, w * 0.03, baseY, w * 0.13, g.h * 0.2, 'SALOON')
      drawBuilding(ctx, rng, w * 0.155, baseY - 2, w * 0.09, g.h * 0.15, 'SHERIFF')
      drawWindmill(ctx, w * 0.26, baseY - g.h * 0.15, g.h * 0.16)
      drawBuilding(ctx, rng, w * 0.84, baseY, w * 0.13, g.h * 0.19, 'HOTEL')
      drawBuilding(ctx, rng, w * 0.75, baseY - 2, w * 0.09, g.h * 0.14, null)
      drawWaterTower(ctx, w * 0.71, baseY - g.h * 0.14, g.h * 0.13)
      break

    case 'sunset': // R2: 붉은 협곡 절벽과 오두막
      drawBuilding(ctx, rng, w * 0.05, baseY, w * 0.12, g.h * 0.16, 'SHACK')
      drawWindmill(ctx, w * 0.18, baseY - g.h * 0.13, g.h * 0.14)
      drawBuilding(ctx, rng, w * 0.82, baseY, w * 0.13, g.h * 0.18, 'TRADING')
      break

    case 'dust': // R3: 유령 폐광 타워 및 제련소
      drawMineTower(ctx, w * 0.08, baseY, g.h * 0.24)
      drawBuilding(ctx, rng, w * 0.18, baseY, w * 0.11, g.h * 0.15, 'ASSAY')
      drawBuilding(ctx, rng, w * 0.80, baseY, w * 0.14, g.h * 0.17, 'GOLD MINE')
      drawWaterTower(ctx, w * 0.74, baseY - g.h * 0.13, g.h * 0.12)
      break

    case 'rail': // R4: 기차역 및 전신주
      drawBuilding(ctx, rng, w * 0.04, baseY, w * 0.15, g.h * 0.19, 'DEPOT')
      drawTelegraphPole(ctx, w * 0.22, baseY, g.h * 0.22)
      drawTelegraphPole(ctx, w * 0.35, baseY - 4, g.h * 0.18)
      drawBuilding(ctx, rng, w * 0.82, baseY, w * 0.14, g.h * 0.18, 'FREIGHT')
      drawTelegraphPole(ctx, w * 0.76, baseY, g.h * 0.22)
      break

    case 'crimson': // R5: 천연 아치 바위 (Natural Arch)
      drawRockArch(ctx, w * 0.12, baseY, w * 0.2, g.h * 0.22)
      drawBuilding(ctx, rng, w * 0.83, baseY, w * 0.12, g.h * 0.16, 'OUTPOST')
      break

    case 'storm': // R6: 폭풍우 속 무너진 교회 종탑
      drawChurch(ctx, w * 0.1, baseY, w * 0.15, g.h * 0.26)
      drawDeadTree(ctx, w * 0.85, baseY, g.h * 0.2)
      break

    case 'twilight': // R7: 카우보이 마차 및 텐트
      drawWagon(ctx, w * 0.1, baseY, w * 0.14, g.h * 0.14)
      drawTent(ctx, w * 0.25, baseY, g.h * 0.12)
      drawWagon(ctx, w * 0.82, baseY, w * 0.13, g.h * 0.13)
      break

    case 'night': // R8: 부트힐 공동묘지 영묘 & 십자가
      drawMausoleum(ctx, w * 0.1, baseY, w * 0.15, g.h * 0.2)
      drawGraveCrosses(ctx, w * 0.26, baseY, 4)
      drawDeadTree(ctx, w * 0.82, baseY, g.h * 0.22)
      drawGraveCrosses(ctx, w * 0.72, baseY, 3)
      break

    case 'eclipse': // R9: 사신의 교수대와 불타버린 폐허
      drawGallows(ctx, w * 0.12, baseY, g.h * 0.25)
      drawBurnedRuin(ctx, w * 0.8, baseY, w * 0.16, g.h * 0.18)
      break
  }
}

/* ==========================================================================
   7. 건물 및 오브젝트 드로잉 서브루틴
   ========================================================================== */

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
  ctx.fillStyle = '#26160e'
  ctx.fillRect(x, top, bw, bh)

  // 상단 파라펫
  ctx.fillStyle = '#301c12'
  ctx.beginPath()
  ctx.moveTo(x - 2, top)
  ctx.lineTo(x + bw / 2, top - bh * 0.12)
  ctx.lineTo(x + bw + 2, top)
  ctx.closePath()
  ctx.fill()

  // 창문
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
    ctx.fillStyle = 'rgba(240, 210, 150, 0.7)'
    ctx.font = `700 ${Math.max(7, Math.round(bw / 9))}px "Paperlogy", "Special Elite", monospace`
    ctx.textAlign = 'center'
    ctx.fillText(sign, x + bw / 2, top + bh * 0.14)
  }
}

function drawWindmill(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.strokeStyle = '#20120b'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x - s * 0.12, y + s)
  ctx.lineTo(x, y)
  ctx.lineTo(x + s * 0.12, y + s)
  ctx.stroke()

  ctx.fillStyle = '#20120b'
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
  ctx.fillStyle = '#20120b'
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

  ctx.strokeStyle = '#20120b'
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.moveTo(x - s * 0.2, y + s * 0.5)
  ctx.lineTo(x - s * 0.3, y + s)
  ctx.moveTo(x + s * 0.2, y + s * 0.5)
  ctx.lineTo(x + s * 0.3, y + s)
  ctx.stroke()
}

function drawMineTower(ctx: CanvasRenderingContext2D, x: number, groundY: number, h: number) {
  ctx.strokeStyle = '#24140b'
  ctx.lineWidth = 2.4
  ctx.beginPath()
  ctx.moveTo(x - h * 0.3, groundY)
  ctx.lineTo(x - h * 0.08, groundY - h)
  ctx.lineTo(x + h * 0.08, groundY - h)
  ctx.lineTo(x + h * 0.3, groundY)
  ctx.stroke()

  // 가로 지지대 & X 트러스
  for (let i = 1; i <= 3; i++) {
    const y = groundY - (h / 4) * i
    ctx.beginPath()
    ctx.moveTo(x - h * 0.25 + i * 5, y)
    ctx.lineTo(x + h * 0.25 - i * 5, y)
    ctx.stroke()
  }

  // 상단 도르래 바퀴
  ctx.fillStyle = '#1a0d07'
  ctx.beginPath()
  ctx.arc(x, groundY - h, h * 0.12, 0, Math.PI * 2)
  ctx.fill()
}

function drawTelegraphPole(ctx: CanvasRenderingContext2D, x: number, groundY: number, h: number) {
  ctx.strokeStyle = '#20120b'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(x, groundY)
  ctx.lineTo(x, groundY - h)
  ctx.stroke()

  // 가로대 (Crossarm)
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x - h * 0.18, groundY - h * 0.9)
  ctx.lineTo(x + h * 0.18, groundY - h * 0.9)
  ctx.stroke()

  // 늘어진 전신선
  ctx.lineWidth = 0.9
  ctx.strokeStyle = 'rgba(30, 18, 10, 0.4)'
  ctx.beginPath()
  ctx.moveTo(x - h * 0.18, groundY - h * 0.9)
  ctx.quadraticCurveTo(x - 50, groundY - h * 0.85, x - 100, groundY - h * 0.88)
  ctx.moveTo(x + h * 0.18, groundY - h * 0.9)
  ctx.quadraticCurveTo(x + 50, groundY - h * 0.85, x + 100, groundY - h * 0.88)
  ctx.stroke()
}

function drawRockArch(ctx: CanvasRenderingContext2D, x: number, groundY: number, w: number, h: number) {
  ctx.fillStyle = '#4a150f'
  ctx.beginPath()
  ctx.moveTo(x, groundY)
  ctx.bezierCurveTo(x, groundY - h * 1.2, x + w, groundY - h * 1.2, x + w, groundY)
  ctx.lineTo(x + w * 0.75, groundY)
  ctx.bezierCurveTo(x + w * 0.7, groundY - h * 0.75, x + w * 0.3, groundY - h * 0.75, x + w * 0.25, groundY)
  ctx.closePath()
  ctx.fill()
}

function drawChurch(ctx: CanvasRenderingContext2D, x: number, groundY: number, w: number, h: number) {
  ctx.fillStyle = '#1c1724'
  ctx.fillRect(x, groundY - h * 0.55, w, h * 0.55)

  // 뾰족한 종탑
  ctx.beginPath()
  ctx.moveTo(x + w * 0.2, groundY - h * 0.55)
  ctx.lineTo(x + w * 0.5, groundY - h)
  ctx.lineTo(x + w * 0.8, groundY - h * 0.55)
  ctx.closePath()
  ctx.fill()

  // 십자가
  ctx.strokeStyle = '#e0d8f0'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x + w * 0.5, groundY - h)
  ctx.lineTo(x + w * 0.5, groundY - h - 16)
  ctx.moveTo(x + w * 0.5 - 6, groundY - h - 11)
  ctx.lineTo(x + w * 0.5 + 6, groundY - h - 11)
  ctx.stroke()
}

function drawDeadTree(ctx: CanvasRenderingContext2D, x: number, groundY: number, h: number) {
  ctx.strokeStyle = '#14121a'
  ctx.lineCap = 'round'
  ctx.lineWidth = h * 0.08
  ctx.beginPath()
  ctx.moveTo(x, groundY)
  ctx.quadraticCurveTo(x - 10, groundY - h * 0.5, x + 4, groundY - h)
  ctx.stroke()

  // 앙상한 가지들
  ctx.lineWidth = h * 0.04
  ctx.beginPath()
  ctx.moveTo(x - 5, groundY - h * 0.55)
  ctx.lineTo(x - h * 0.25, groundY - h * 0.75)
  ctx.moveTo(x + 2, groundY - h * 0.7)
  ctx.lineTo(x + h * 0.28, groundY - h * 0.9)
  ctx.stroke()
}

function drawWagon(ctx: CanvasRenderingContext2D, x: number, groundY: number, w: number, h: number) {
  ctx.fillStyle = '#e8dcc8'
  ctx.beginPath()
  ctx.ellipse(x + w / 2, groundY - h * 0.65, w * 0.45, h * 0.35, 0, Math.PI, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#2e1c12'
  ctx.fillRect(x + w * 0.1, groundY - h * 0.5, w * 0.8, h * 0.25)

  // 바퀴
  ctx.strokeStyle = '#1c100a'
  ctx.lineWidth = 2.2
  ctx.beginPath()
  ctx.arc(x + w * 0.25, groundY - h * 0.2, h * 0.2, 0, Math.PI * 2)
  ctx.arc(x + w * 0.75, groundY - h * 0.25, h * 0.25, 0, Math.PI * 2)
  ctx.stroke()
}

function drawTent(ctx: CanvasRenderingContext2D, x: number, groundY: number, h: number) {
  ctx.fillStyle = '#c4b294'
  ctx.beginPath()
  ctx.moveTo(x, groundY)
  ctx.lineTo(x + h * 0.5, groundY - h)
  ctx.lineTo(x + h, groundY)
  ctx.closePath()
  ctx.fill()
}

function drawMausoleum(ctx: CanvasRenderingContext2D, x: number, groundY: number, w: number, h: number) {
  ctx.fillStyle = '#101a24'
  ctx.fillRect(x, groundY - h * 0.7, w, h * 0.7)

  // 지붕 페디먼트
  ctx.beginPath()
  ctx.moveTo(x - 4, groundY - h * 0.7)
  ctx.lineTo(x + w / 2, groundY - h)
  ctx.lineTo(x + w + 4, groundY - h * 0.7)
  ctx.closePath()
  ctx.fill()
}

function drawGraveCrosses(ctx: CanvasRenderingContext2D, startX: number, groundY: number, count: number) {
  ctx.strokeStyle = '#152230'
  ctx.lineWidth = 2.4
  for (let i = 0; i < count; i++) {
    const gx = startX + i * 22
    const gh = 18 + (i % 2) * 8
    ctx.beginPath()
    ctx.moveTo(gx, groundY)
    ctx.lineTo(gx, groundY - gh)
    ctx.moveTo(gx - 6, groundY - gh * 0.7)
    ctx.lineTo(gx + 6, groundY - gh * 0.7)
    ctx.stroke()
  }
}

function drawGallows(ctx: CanvasRenderingContext2D, x: number, groundY: number, h: number) {
  ctx.strokeStyle = '#260408'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(x, groundY)
  ctx.lineTo(x, groundY - h)
  ctx.lineTo(x + h * 0.4, groundY - h)
  ctx.stroke()

  // 밧줄 올가미
  ctx.lineWidth = 1.4
  ctx.strokeStyle = '#ff3322'
  ctx.beginPath()
  ctx.moveTo(x + h * 0.35, groundY - h)
  ctx.lineTo(x + h * 0.35, groundY - h * 0.65)
  ctx.stroke()
}

function drawBurnedRuin(ctx: CanvasRenderingContext2D, x: number, groundY: number, w: number, h: number) {
  ctx.fillStyle = '#140103'
  ctx.beginPath()
  ctx.moveTo(x, groundY)
  ctx.lineTo(x + w * 0.2, groundY - h * 0.8)
  ctx.lineTo(x + w * 0.4, groundY - h * 0.4)
  ctx.lineTo(x + w * 0.7, groundY - h * 0.9)
  ctx.lineTo(x + w, groundY)
  ctx.closePath()
  ctx.fill()
}

/* ==========================================================================
   8. 전경 소품 (선인장, 해골, 묘비, 자갈, 안개)
   ========================================================================== */

function paintProps(
  ctx: CanvasRenderingContext2D,
  g: SceneGeometry,
  rng: () => number,
  theme: ThemeInfo,
) {
  const { w, h, horizon } = g

  if (theme.skyType !== 'night' && theme.skyType !== 'eclipse') {
    drawCactus(ctx, w * 0.075, horizon + h * 0.13, h * 0.15)
    drawCactus(ctx, w * 0.93, horizon + h * 0.18, h * 0.19)
    drawCactus(ctx, w * 0.35, horizon + h * 0.04, h * 0.06)
  }

  // 자갈과 마른 풀
  for (let i = 0; i < 85; i++) {
    const p = rng()
    const y = horizon + (h - horizon) * (p * p)
    const x = rng() * w
    const depth = (y - horizon) / (h - horizon)
    const size = 1 + depth * 4

    if (rng() > 0.42) {
      ctx.fillStyle = theme.skyType === 'night' ? `rgba(16, 26, 40, ${0.3 + depth * 0.4})` : `rgba(48, 26, 12, ${0.25 + depth * 0.4})`
      ctx.beginPath()
      ctx.ellipse(x, y, size, size * 0.6, 0, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.strokeStyle = theme.skyType === 'night' ? `rgba(60, 90, 120, ${0.3 + depth * 0.35})` : `rgba(120, 92, 44, ${0.3 + depth * 0.35})`
      ctx.lineWidth = 1
      for (let b = 0; b < 3; b++) {
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x + (b - 1) * size * 1.6, y - size * 2.4)
        ctx.stroke()
      }
    }
  }

  // 지평선 주변 뎁스 헤이즈
  const depthHaze = ctx.createLinearGradient(0, horizon - h * 0.05, 0, horizon + h * 0.14)
  const hazeColor =
    theme.skyType === 'night'
      ? 'rgba(40, 80, 120, 0.25)'
      : theme.skyType === 'eclipse'
        ? 'rgba(220, 30, 20, 0.32)'
        : 'rgba(255, 176, 100, 0.32)'

  depthHaze.addColorStop(0, hazeColor)
  depthHaze.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = depthHaze
  ctx.fillRect(0, horizon - h * 0.05, w, h * 0.2)
}

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

  ctx.strokeStyle = 'rgba(255, 186, 108, 0.4)'
  ctx.lineWidth = Math.max(1, trunk * 0.2)
  ctx.beginPath()
  ctx.moveTo(x + trunk * 0.36, groundY - trunk * 0.5)
  ctx.lineTo(x + trunk * 0.36, groundY - height + trunk * 0.3)
  ctx.stroke()
  ctx.restore()
}
