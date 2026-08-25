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
  // 베이스 탄띠 (고급 브라이들 새들 레더)
  const belt = ctx.createLinearGradient(0, -2, 0, 26)
  belt.addColorStop(0, '#784620')
  belt.addColorStop(0.2, '#542e14')
  belt.addColorStop(0.65, '#2e180a')
  belt.addColorStop(1, '#140804')
  ctx.fillStyle = belt
  roundedPath(ctx, -spanHalf, 0, spanHalf * 2, 24, 3)
  ctx.fill()

  // 가죽 상/하단 베벨 및 엣지 하이라이트
  ctx.fillStyle = 'rgba(255, 210, 140, 0.32)'
  ctx.fillRect(-spanHalf, 1, spanHalf * 2, 1.8)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
  ctx.fillRect(-spanHalf, 22, spanHalf * 2, 2)

  // 상하단 듀얼 새들 스티칭 (아이보리 굵은 실밥)
  ctx.strokeStyle = 'rgba(240, 220, 180, 0.48)'
  ctx.lineWidth = 1.1
  ctx.setLineDash([2.5, 3.2])
  ctx.beginPath()
  ctx.moveTo(-spanHalf + 4, 4.5)
  ctx.lineTo(spanHalf - 4, 4.5)
  ctx.moveTo(-spanHalf + 4, 19.5)
  ctx.lineTo(spanHalf - 4, 19.5)
  ctx.stroke()
  ctx.setLineDash([])

  // 서부식 인그레이빙 황동 버클
  const buckle = ctx.createLinearGradient(-84, -4, -48, 28)
  buckle.addColorStop(0, '#fbeaa0')
  buckle.addColorStop(0.35, '#d4a838')
  buckle.addColorStop(0.7, '#8c5c14')
  buckle.addColorStop(1, '#422806')
  ctx.fillStyle = buckle
  roundedPath(ctx, -82, -3.5, 32, 31, 4)
  ctx.fill()
  ctx.strokeStyle = '#281604'
  ctx.lineWidth = 1.8
  ctx.stroke()

  // 버클 내부 구멍 & 핀
  ctx.fillStyle = '#1c1006'
  roundedPath(ctx, -73, 4.5, 14, 15, 2.5)
  ctx.fill()
  ctx.strokeStyle = '#d4a838'
  ctx.lineWidth = 1
  ctx.stroke()
  // 버클 프롱(핀)
  ctx.fillStyle = '#fbeaa0'
  ctx.fillRect(-67, 1, 3, 22)

  // .45 Long Colt 황동 탄환 6발 (탄띠 루프 + 탄두/뇌관 디테일)
  for (let i = 0; i < 6; i++) {
    const bx = 38 + i * 15.5

    // 가죽 탄환 홀더 루프
    ctx.fillStyle = '#221206'
    roundedPath(ctx, bx - 6, 0.5, 12, 22, 2.5)
    ctx.fill()
    ctx.strokeStyle = '#442410'
    ctx.lineWidth = 1
    ctx.stroke()

    // 황동 탄피 몸체 그라디언트
    const brass = ctx.createLinearGradient(bx - 3.5, 2, bx + 3.5, 20)
    brass.addColorStop(0, '#faea98')
    brass.addColorStop(0.3, '#d8ac28')
    brass.addColorStop(0.75, '#8c6214')
    brass.addColorStop(1, '#4a3206')
    ctx.fillStyle = brass
    roundedPath(ctx, bx - 3.5, 5, 7, 14, 1.5)
    ctx.fill()

    // 탄피 림(Rim) & 구리 뇌관(Primer)
    ctx.fillStyle = '#e8be34'
    ctx.beginPath()
    ctx.ellipse(bx, 4.5, 3.8, 2.2, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#6a480a'
    ctx.lineWidth = 0.8
    ctx.stroke()

    // 중앙 구리 뇌관
    ctx.fillStyle = '#b85828'
    ctx.beginPath()
    ctx.arc(bx, 4.5, 1.3, 0, Math.PI * 2)
    ctx.fill()

    // 탄피 금속 반사광
    ctx.fillStyle = 'rgba(255, 255, 220, 0.65)'
    ctx.fillRect(bx - 2.4, 5.5, 1.2, 13)
  }
}

function holsterPouchPath(ctx: CanvasRenderingContext2D, mouth: number) {
  ctx.beginPath()
  ctx.moveTo(-32, mouth)
  ctx.quadraticCurveTo(0, mouth + 2, 28, mouth + 6)
  ctx.quadraticCurveTo(34, mouth + 20, 30, mouth + 44)
  ctx.quadraticCurveTo(24, mouth + 82, 3, mouth + 96)
  ctx.quadraticCurveTo(-16, mouth + 94, -25, mouth + 62)
  ctx.quadraticCurveTo(-36, mouth + 28, -32, mouth)
  ctx.closePath()
}

function fillHolsterPouch(
  ctx: CanvasRenderingContext2D,
  mouth: number,
  layer: 'back' | 'front',
) {
  const pouch = ctx.createLinearGradient(-34, mouth, 30, mouth + 40)
  if (layer === 'back') {
    pouch.addColorStop(0, '#140a04')
    pouch.addColorStop(1, '#2c1408')
  } else {
    pouch.addColorStop(0, '#2e1408')
    pouch.addColorStop(0.3, '#5c2d12')
    pouch.addColorStop(0.7, '#8e4a1e')
    pouch.addColorStop(1, '#b86628')
  }
  ctx.fillStyle = pouch
  holsterPouchPath(ctx, mouth)
  ctx.fill()
}

function drawHolsterLeather(ctx: CanvasRenderingContext2D, mouth: number, empty: boolean) {
  // 홀스터 외곽 가죽 번 피니시
  ctx.strokeStyle = '#180a04'
  ctx.lineWidth = 2.4
  holsterPouchPath(ctx, mouth)
  ctx.stroke()

  // 홀스터 가장자리 더블 스티칭
  ctx.strokeStyle = 'rgba(242, 218, 172, 0.55)'
  ctx.lineWidth = 1.2
  ctx.setLineDash([2.6, 3.4])
  ctx.beginPath()
  ctx.moveTo(-26, mouth + 10)
  ctx.quadraticCurveTo(-28, mouth + 42, -16, mouth + 76)
  ctx.moveTo(22, mouth + 14)
  ctx.quadraticCurveTo(22, mouth + 46, 7, mouth + 82)
  ctx.stroke()
  ctx.setLineDash([])

  // 홀스터 전면 엠보싱 툴링 라인 (웨스턴 장식 음각)
  ctx.strokeStyle = 'rgba(40, 18, 6, 0.6)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(-16, mouth + 22)
  ctx.quadraticCurveTo(-2, mouth + 38, 12, mouth + 26)
  ctx.quadraticCurveTo(16, mouth + 54, -2, mouth + 68)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(255, 200, 130, 0.25)'
  ctx.lineWidth = 1
  ctx.stroke()

  // 홀스터 입구 깊이 그림자
  ctx.fillStyle = empty ? 'rgba(4, 2, 1, 0.95)' : 'rgba(8, 4, 1, 0.35)'
  ctx.beginPath()
  ctx.ellipse(-2, mouth + 4, 27, 7, 0.08, 0, Math.PI * 2)
  ctx.fill()

  // 홀스터 고정 가죽 스트랩 (멕시칸 루프 밴드)
  const strapGrad = ctx.createLinearGradient(-32, mouth + 34, 30, mouth + 48)
  strapGrad.addColorStop(0, '#3a1a0a')
  strapGrad.addColorStop(0.5, '#6a3416')
  strapGrad.addColorStop(1, '#341608')
  ctx.fillStyle = strapGrad
  ctx.beginPath()
  ctx.moveTo(-33, mouth + 34)
  ctx.lineTo(30, mouth + 40)
  ctx.lineTo(29, mouth + 53)
  ctx.lineTo(-32, mouth + 47)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#180802'
  ctx.lineWidth = 1.4
  ctx.stroke()

  // 스트랩 스티치 & 하이라이트
  ctx.fillStyle = 'rgba(255, 210, 140, 0.28)'
  ctx.fillRect(-31, mouth + 35, 59, 1.4)

  // 황동 리벳 / 콘초 장식
  const concho = ctx.createRadialGradient(16, mouth + 44, 0.5, 16, mouth + 44, 5.5)
  concho.addColorStop(0, '#fff0a8')
  concho.addColorStop(0.35, '#d4a028')
  concho.addColorStop(0.8, '#7a5210')
  concho.addColorStop(1, '#321e04')
  ctx.fillStyle = concho
  ctx.beginPath()
  ctx.arc(16, mouth + 44, 4.8, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#241402'
  ctx.lineWidth = 0.9
  ctx.stroke()

  // 황동 징(Studs)
  ctx.fillStyle = '#d4a838'
  ctx.beginPath()
  ctx.arc(-22, mouth + 16, 2.2, 0, Math.PI * 2)
  ctx.arc(20, mouth + 20, 2.2, 0, Math.PI * 2)
  ctx.arc(-8, mouth + 82, 2.2, 0, Math.PI * 2)
  ctx.fill()
}

/** 콜트 싱글 액션 아미 .45 (피스메이커) — 정밀 건메탈 & 월넛 목재 그립 */
function drawHolsteredRevolver(
  ctx: CanvasRenderingContext2D,
  mouth: number,
  layer: 'barrel' | 'exposed',
) {
  ctx.save()
  ctx.translate(0, mouth + 1)
  ctx.rotate(0.38) // 홀스터에 자연스럽게 사선으로 꽂힌 각도

  if (layer === 'barrel') {
    // 5.5인치 블루드 스틸 배럴 (총열)
    const barrel = ctx.createLinearGradient(-6, 8, 6, 8)
    barrel.addColorStop(0, '#5a5a68')
    barrel.addColorStop(0.35, '#2c2c36')
    barrel.addColorStop(0.7, '#14141c')
    barrel.addColorStop(1, '#06060a')
    ctx.fillStyle = barrel
    roundedPath(ctx, -5.5, 10, 11, 56, 2.5)
    ctx.fill()

    // 총열 측면 금속 반사광
    ctx.fillStyle = 'rgba(230, 235, 255, 0.38)'
    ctx.fillRect(-4.2, 12, 1.8, 52)
    ctx.restore()
    return
  }

  // ===================== 1. 실린더 & 프레임 (Cylinder & Frame) =====================

  // 실린더 본체 (Fluted Cylinder)
  const cylGrad = ctx.createLinearGradient(-13, 0, 13, 20)
  cylGrad.addColorStop(0, '#828292')
  cylGrad.addColorStop(0.35, '#444450')
  cylGrad.addColorStop(0.75, '#1e1e26')
  cylGrad.addColorStop(1, '#0a0a10')
  ctx.fillStyle = cylGrad
  roundedPath(ctx, -13, 4, 26, 17, 3.5)
  ctx.fill()
  ctx.strokeStyle = 'rgba(220, 225, 240, 0.45)'
  ctx.lineWidth = 1.2
  ctx.stroke()

  // 실린더 홈(Flutes - 입체적인 3D 홈 파임)
  for (let i = -1; i <= 1; i++) {
    const fx = i * 8
    const flute = ctx.createLinearGradient(fx - 2.5, 6, fx + 2.5, 6)
    flute.addColorStop(0, '#0a0a0e')
    flute.addColorStop(0.5, '#16161e')
    flute.addColorStop(1, '#08080c')
    ctx.fillStyle = flute
    roundedPath(ctx, fx - 2.5, 6.5, 5, 12, 2)
    ctx.fill()

    // 홈 경계 금속 하이라이트
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
    ctx.fillRect(fx - 2.5, 7, 0.8, 11)
  }

  // 탑 스트랩 & 리코일 쉴드 (총몸 프레임)
  const frameGrad = ctx.createLinearGradient(-12, -4, 12, 4)
  frameGrad.addColorStop(0, '#666676')
  frameGrad.addColorStop(0.4, '#32323e')
  frameGrad.addColorStop(1, '#121218')
  ctx.fillStyle = frameGrad
  ctx.beginPath()
  ctx.moveTo(-13, 4)
  ctx.lineTo(13, 4)
  ctx.lineTo(11, -3)
  ctx.lineTo(-11, -3)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)'
  ctx.fillRect(-10, -2.5, 20, 1.2)

  // ===================== 2. 해머 (Hammer / 공이) =====================
  const hammerGrad = ctx.createLinearGradient(-10, -16, 0, -2)
  hammerGrad.addColorStop(0, '#888898')
  hammerGrad.addColorStop(0.5, '#3c3c48')
  hammerGrad.addColorStop(1, '#16161e')
  ctx.fillStyle = hammerGrad
  ctx.beginPath()
  ctx.moveTo(-4, -1)
  ctx.lineTo(-9, -15)
  ctx.quadraticCurveTo(-14, -18, -12, -22) // 해머 스퍼 엄지 곡선
  ctx.lineTo(-6, -18)
  ctx.lineTo(2, -2)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#181822'
  ctx.lineWidth = 1.1
  ctx.stroke()

  // 해머 체커링 (미끄럼 방지 요철)
  ctx.fillStyle = 'rgba(255, 240, 200, 0.55)'
  ctx.fillRect(-11, -20, 4, 1)
  ctx.fillRect(-10, -18.5, 4, 1)
  ctx.fillRect(-9, -17, 4, 1)

  // ===================== 3. 방아쇠울 & 방아쇠 (Trigger Guard) =====================
  ctx.strokeStyle = '#c49a34' // 황동 방아쇠울 (Brass Trigger Guard)
  ctx.lineWidth = 2.4
  ctx.beginPath()
  ctx.arc(0, 20, 8, 0.3, Math.PI - 0.2)
  ctx.stroke()
  // 방아쇠
  ctx.strokeStyle = '#22222a'
  ctx.lineWidth = 1.8
  ctx.beginPath()
  ctx.moveTo(-1, 18)
  ctx.quadraticCurveTo(2, 22, -1, 24)
  ctx.stroke()

  // ===================== 4. 월넛 목재 그립 (Walnut Hardwood Grip) =====================
  // 클래식 콜트 플라우핸들(Plowhandle) 우아한 곡선 손잡이
  const wood = ctx.createLinearGradient(-10, 2, -32, -38)
  wood.addColorStop(0, '#e89e4c') // 밝은 광택 호두나무
  wood.addColorStop(0.25, '#ab561e')
  wood.addColorStop(0.65, '#5e260a')
  wood.addColorStop(1, '#2c0e04') // 짙은 에지
  ctx.fillStyle = wood
  ctx.beginPath()
  ctx.moveTo(-6, 2)
  ctx.quadraticCurveTo(-6, -10, -12, -22)
  ctx.quadraticCurveTo(-18, -42, -30, -38) // 그립 꼭대기 둥근 숄더
  ctx.quadraticCurveTo(-38, -26, -26, -10) // 그립 후면 팜스웰(Palm swell)
  ctx.quadraticCurveTo(-16, 8, -4, 8)
  ctx.closePath()
  ctx.fill()

  // 그립 테두리 번 피니시
  ctx.strokeStyle = '#1e0802'
  ctx.lineWidth = 1.6
  ctx.stroke()

  // 정교한 목재 나뭇결 (Hardwood Grain)
  ctx.strokeStyle = 'rgba(46, 16, 6, 0.55)'
  ctx.lineWidth = 0.9
  for (let i = 0; i < 6; i++) {
    ctx.beginPath()
    ctx.moveTo(-8 - i * 1.5, -2 - i * 4.5)
    ctx.quadraticCurveTo(-16 - i * 1.8, -16 - i * 3.5, -26 - i * 0.8, -26 - i * 1.5)
    ctx.stroke()
  }

  // 그립 전면 하이라이트 (빛에 반사된 래커 왁스 광택)
  ctx.strokeStyle = 'rgba(255, 225, 170, 0.55)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(-7, -2)
  ctx.quadraticCurveTo(-11, -18, -25, -34)
  ctx.stroke()

  // 콜트 황동 메달리온 (Grip Medallion Inset)
  const med = ctx.createRadialGradient(-18, -18, 0.5, -18, -18, 3.2)
  med.addColorStop(0, '#fff4b8')
  med.addColorStop(0.4, '#d8ac32')
  med.addColorStop(1, '#5a3808')
  ctx.fillStyle = med
  ctx.beginPath()
  ctx.arc(-18, -18, 3, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#2a1604'
  ctx.lineWidth = 0.7
  ctx.stroke()

  // 하단 황동 백스트랩 스크류
  ctx.fillStyle = '#22222a'
  ctx.beginPath()
  ctx.arc(-8, 3, 1.8, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

function drawGrippingHand(ctx: CanvasRenderingContext2D, pt: number, t: number) {
  const hx = -8 + Math.sin(t / 50) * 1.4
  const hy = pt + 2

  // 가죽 장갑 손등 (Gunslinger Leather Glove)
  const glove = ctx.createLinearGradient(hx - 16, hy - 8, hx + 16, hy + 20)
  glove.addColorStop(0, '#5a3418')
  glove.addColorStop(0.5, '#381e0c')
  glove.addColorStop(1, '#180c04')
  ctx.fillStyle = glove
  roundedPath(ctx, hx - 16, hy - 6, 32, 28, 7)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255, 210, 140, 0.5)'
  ctx.lineWidth = 1.4
  ctx.stroke()

  // 손가락 관절 (4개 손가락으로 그립을 꽉 쥔 형상)
  for (let i = 0; i < 4; i++) {
    const fingerGrad = ctx.createLinearGradient(hx - 14 + i * 8, hy + 10, hx - 14 + i * 8, hy + 22)
    fingerGrad.addColorStop(0, '#4a2810')
    fingerGrad.addColorStop(1, '#200e04')
    ctx.fillStyle = fingerGrad
    roundedPath(ctx, hx - 14 + i * 8, hy + 12, 7.5, 11, 3.5)
    ctx.fill()
    ctx.strokeStyle = '#140602'
    ctx.lineWidth = 0.8
    ctx.stroke()
  }

  // 엄지손가락 & 손목 가죽 밴드
  ctx.fillStyle = '#2c1608'
  roundedPath(ctx, hx - 12, hy - 18, 24, 15, 4)
  ctx.fill()
  ctx.fillStyle = 'rgba(255, 200, 130, 0.35)'
  ctx.fillRect(hx + 8, hy - 18, 2, 15)
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
