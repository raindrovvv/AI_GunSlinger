/**
 * 하프톤 — 1880년대 신문 사진 흉내.
 *
 * 당시 신문은 사진을 그대로 못 실었다. 잉크는 진하거나 안 찍히거나 둘뿐이라
 * 중간 회색을 낼 수가 없어서, 명암을 점의 크기로 바꿔 찍었다(스크린 판).
 * 밝은 곳은 점이 작고 어두운 곳은 점이 굵어져 멀리서 보면 회색으로 뭉친다.
 *
 * 여기서도 같은 걸 한다. 초상화를 격자로 훑으면서 칸마다 평균 밝기를 재고,
 * 그 값에 반비례하는 반지름의 점을 찍는다. 격자를 45도로 눕히는 건 실제
 * 인쇄에서 쓰던 각도로, 점열이 가로세로로 줄 서 보이는 걸 막는다.
 */

export interface HalftoneOptions {
  /** 출력 한 변(px) */
  size: number
  /** 점 격자 간격(px). 작을수록 곱고 느리다 */
  cell?: number
  /** 잉크 색 */
  ink?: string
  /** 종이 색. null이면 배경을 비운다(투명) */
  paper?: string | null
  /** 밝기 하한/상한 — 이 사이를 점 크기 전체 범위에 펼친다 */
  black?: number
  white?: number
  /** 점 굵기 곡선. 1보다 크면 중간톤이 얇아져 얼굴이 덜 뭉친다 */
  gamma?: number
}

/**
 * 이미지를 하프톤 캔버스로 굽는다.
 * 원본은 배경이 지워진 PNG/WebP라 투명한 곳은 점을 찍지 않는다.
 */
export function halftone(
  img: CanvasImageSource,
  opts: HalftoneOptions,
): HTMLCanvasElement | null {
  const {
    size,
    cell = 4,
    ink = '#1a0c06',
    paper = null,
    black = 0.04,
    white = 0.99,
    gamma = 1.35,
  } = opts

  const out = document.createElement('canvas')
  out.width = size
  out.height = size
  const octx = out.getContext('2d')
  if (!octx) return null

  // 원본을 한 번 평평하게 받아 픽셀을 읽는다
  const src = document.createElement('canvas')
  src.width = size
  src.height = size
  const sctx = src.getContext('2d', { willReadFrequently: true })
  if (!sctx) return null
  sctx.drawImage(img, 0, 0, size, size)

  let data: Uint8ClampedArray
  try {
    data = sctx.getImageData(0, 0, size, size).data
  } catch {
    // 다른 출처 이미지면 캔버스가 오염돼 읽을 수 없다. 그때는 포기한다.
    return null
  }

  if (paper) {
    octx.fillStyle = paper
    octx.fillRect(0, 0, size, size)
  }
  octx.fillStyle = ink

  const step = Math.max(2, cell)
  const span = Math.max(0.01, white - black)
  // 45도로 눕힌 격자. 홀수 줄을 반 칸 밀어 점열을 어긋나게 한다.
  const rows = Math.ceil(size / step) + 1

  for (let r = 0; r < rows; r += 1) {
    const cy = r * step + step / 2
    const offset = r % 2 ? step / 2 : 0
    for (let cx = offset; cx < size + step; cx += step) {
      let sum = 0
      let alpha = 0
      let n = 0

      const x0 = Math.max(0, Math.floor(cx - step / 2))
      const x1 = Math.min(size, Math.ceil(cx + step / 2))
      const y0 = Math.max(0, Math.floor(cy - step / 2))
      const y1 = Math.min(size, Math.ceil(cy + step / 2))

      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const i = (y * size + x) * 4
          // Rec.601 휘도. 사람 눈이 초록에 민감한 걸 반영한다.
          sum += (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255
          alpha += data[i + 3] / 255
          n += 1
        }
      }
      if (!n) continue

      const cover = alpha / n
      if (cover < 0.35) continue // 배경이 지워진 자리

      const lum = sum / n / Math.max(cover, 0.01)
      // 계조를 곧이곧대로 점 크기에 넣으면 중간톤부터 점이 서로 붙어 얼굴이
      // 검은 덩어리가 된다. 감마로 눌러 어두운 쪽만 굵어지게 한다.
      const raw = 1 - Math.min(1, Math.max(0, (lum - black) / span))
      const dark = Math.pow(raw, gamma)
      if (dark <= 0.02) continue

      // 면적이 명암에 비례해야 하므로 반지름은 제곱근을 쓴다.
      // 그냥 dark를 반지름에 넣으면 어두운 쪽이 뭉개진다.
      const radius = Math.sqrt(dark) * step * 0.58 * cover
      if (radius < 0.25) continue

      octx.beginPath()
      octx.arc(cx, cy, radius, 0, Math.PI * 2)
      octx.fill()
    }
  }

  return out
}

/** 이미지 한 장을 불러온다. 실패하면 null — 호출부가 초상화를 건너뛴다. */
export function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}
