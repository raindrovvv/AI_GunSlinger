import { portraitSrc } from '../data/portraits'
import { pressPortraitEnabled } from '../gl/flags'
import { halftone, loadImage } from './halftone'
import type { DuelOutcome, NewspaperArticle, Opponent } from '../types'

interface GenerateOptions {
  article: NewspaperArticle
  opponent: Opponent
  playerWon: boolean
  peace: boolean
  round: number
  reward: number
  outcome: DuelOutcome | null
}

export async function downloadNewspaperImage(opts: GenerateOptions) {
  const { article, opponent, playerWon, peace, round, reward, outcome } = opts
  const width = 800
  const height = 1100

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // 초상화는 그리기 전에 미리 받아둔다. 실패하면 없는 채로 진행한다 —
  // 신문 저장이 이미지 한 장 때문에 통째로 막히면 안 된다.
  const mug = pressPortraitEnabled() ? await loadImage(portraitSrc(opponent, round)) : null

  // 1. 빈티지 신문 종이 배경 그라데이션
  const bg = ctx.createLinearGradient(0, 0, width, height)
  bg.addColorStop(0, '#fbf3e4')
  bg.addColorStop(0.5, '#f4e7ce')
  bg.addColorStop(1, '#ebd7b2')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, width, height)

  // 2. 종이 노이즈 및 얼룩 효과
  ctx.fillStyle = 'rgba(120, 80, 30, 0.03)'
  for (let i = 0; i < 4000; i++) {
    const rx = Math.random() * width
    const ry = Math.random() * height
    ctx.fillRect(rx, ry, 1 + Math.random() * 2, 1 + Math.random() * 2)
  }

  // 3. 서부 신문 이중 테두리
  ctx.strokeStyle = '#2b1b12'
  ctx.lineWidth = 4
  ctx.strokeRect(24, 24, width - 48, height - 48)
  ctx.lineWidth = 1.2
  ctx.strokeRect(30, 30, width - 60, height - 60)

  // 코너 장식
  drawCornerDecor(ctx, 30, 30, 1)
  drawCornerDecor(ctx, width - 30, 30, 2)
  drawCornerDecor(ctx, 30, height - 30, 3)
  drawCornerDecor(ctx, width - 30, height - 30, 4)

  // 4. 최상단 헤더
  ctx.fillStyle = '#4a3020'
  ctx.font = '700 13px "Cinzel", "Times New Roman", serif'
  ctx.textAlign = 'center'
  ctx.letterSpacing = '3px'
  ctx.fillText('★ THE WESTERN FRONTIER TELEGRAPH & DAILY RECORD ★', width / 2, 60)

  // 구분선
  drawDoubleLine(ctx, 45, width - 45, 72)

  // 5. 메인 마스트헤드 (DUST TOWN GAZETTE)
  ctx.fillStyle = '#1c1008'
  ctx.font = '900 48px "Rye", "Cinzel Decorative", "Times New Roman", serif'
  ctx.fillText('DUST TOWN GAZETTE', width / 2, 126)

  // 날짜 & 권호
  ctx.font = 'italic 600 14px "Special Elite", "Courier New", monospace'
  ctx.fillStyle = '#442b1a'
  ctx.fillText(`OCTOBER 14, 1879 · VOL. XII · ISSUE NO. ${round} · PRICE: TWO BITS (25¢)`, width / 2, 154)

  drawDoubleLine(ctx, 45, width - 45, 168)

  // 6. 결과 스탬프 (VICTORY / DEFEAT / PEACE)
  const status = peace ? 'PEACE' : playerWon ? 'VICTORY' : 'DEFEAT'
  ctx.save()
  ctx.translate(width - 150, 220)
  ctx.rotate((-12 * Math.PI) / 180)
  const stampColor = peace ? '#1b5e20' : playerWon ? '#b71c1c' : '#263238'
  ctx.strokeStyle = stampColor
  ctx.fillStyle = stampColor
  ctx.lineWidth = 4
  ctx.strokeRect(-80, -26, 160, 52)
  ctx.font = '900 28px "Cinzel Decorative", "Impact", monospace'
  ctx.textAlign = 'center'
  ctx.fillText(status, 0, 10)
  ctx.restore()

  // 7. 헤드라인
  ctx.textAlign = 'left'
  ctx.fillStyle = '#1a0c06'
  ctx.font = '900 30px "Paperlogy", "Cinzel", "Times New Roman", serif'
  const headlineLines = wrapText(ctx, article.headline, width - 290)
  let curY = 220
  for (const line of headlineLines) {
    ctx.fillText(line, 54, curY)
    curY += 38
  }

  // 8. 바이라인 (Byline)
  ctx.fillStyle = '#5c3d2e'
  ctx.font = 'italic 700 16px "Paperlogy", "Special Elite", serif'
  ctx.fillText(`VS ${opponent.alias} (현상금 $${opponent.bounty.toLocaleString()})`, 54, curY + 6)
  curY += 24

  ctx.strokeStyle = 'rgba(60, 35, 20, 0.4)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(54, curY)
  ctx.lineTo(width - 54, curY)
  ctx.stroke()
  curY += 26

  // 9. 기사 본문 (Body)
  ctx.fillStyle = '#24140b'
  ctx.font = '500 17px "Paperlogy", "Georgia", "Times New Roman", serif'
  // 초상화가 오른쪽에 들어가면 본문이 그 밑으로 파고들지 않게 단을 좁힌다
  const bodyLines = wrapText(ctx, article.body, width - 108 - (mug ? 168 : 0))
  for (const line of bodyLines) {
    ctx.fillText(line, 54, curY)
    curY += 26
  }
  curY += 16

  // 10. 수배 사진 — 하프톤
  if (mug) {
    const box = 150
    const px = width - 54 - box
    const py = 300
    const plate = halftone(mug, { size: box, cell: 3.4, ink: '#1a0c06', paper: null })
    if (plate) {
      ctx.fillStyle = 'rgba(255, 252, 244, 0.5)'
      ctx.fillRect(px, py, box, box)
      ctx.drawImage(plate, px, py)
      ctx.strokeStyle = '#2b1b12'
      ctx.lineWidth = 2
      ctx.strokeRect(px, py, box, box)
      ctx.lineWidth = 1
      ctx.strokeRect(px - 5, py - 5, box + 10, box + 10)

      ctx.textAlign = 'center'
      ctx.fillStyle = '#5c3d2e'
      ctx.font = '600 11px "Special Elite", "Courier New", monospace'
      ctx.fillText(clip(opponent.alias, 14), px + box / 2, py + box + 20)
      ctx.textAlign = 'left'
      ctx.fillStyle = '#24140b'
    }
    // 본문이 짧아도 인용구 상자가 사진을 덮지 않게 한다
    curY = Math.max(curY, py + box + 34)
  }

  // 11. 인용구 상자 (Quote Box)
  if (article.quote) {
    ctx.fillStyle = 'rgba(70, 40, 20, 0.08)'
    ctx.fillRect(54, curY, width - 108, 68)
    ctx.strokeStyle = '#8a5a36'
    ctx.lineWidth = 2
    ctx.strokeRect(54, curY, width - 108, 68)

    ctx.fillStyle = '#2e180d'
    ctx.font = 'italic 600 16px "Paperlogy", "Georgia", serif'
    const quoteLines = wrapText(ctx, `“${article.quote}”`, width - 140)
    let qY = curY + 28
    for (const q of quoteLines.slice(0, 2)) {
      ctx.fillText(q, 72, qY)
      qY += 22
    }
    curY += 92
  }

  // 12. 결투 성적 렛저 (Duel Ledger)
  ctx.fillStyle = 'rgba(30, 16, 8, 0.06)'
  ctx.fillRect(54, height - 160, width - 108, 74)
  ctx.strokeStyle = '#4a2c1b'
  ctx.lineWidth = 1.5
  ctx.strokeRect(54, height - 160, width - 108, 74)

  ctx.fillStyle = '#1c1008'
  ctx.font = '700 15px "Cinzel", "Paperlogy", monospace'
  ctx.fillText('DUEL SUMMARY LEDGER', 70, height - 134)

  ctx.font = '600 14px "Special Elite", monospace'
  const speedText = outcome?.reactionMs != null ? `${outcome.reactionMs}ms` : '-'
  const gradeText = outcome?.grade && outcome.grade !== '-' ? outcome.grade : 'NONE'
  const headText = outcome?.headshot ? 'CRITICAL HEADSHOT' : 'BODY HIT'
  const rewardText = reward > 0 ? `$${reward.toLocaleString()}` : '$0'

  ctx.fillText(`DRAW: ${speedText}  |  GRADE: ${gradeText}  |  HIT: ${headText}  |  BOUNTY: ${rewardText}`, 70, height - 104)

  // 13. 푸터 워터마크
  ctx.textAlign = 'center'
  ctx.fillStyle = '#6b4d38'
  ctx.font = '600 12px "Cinzel", monospace'
  ctx.fillText('AI GUNSLINGER · https://ai-gunslinger.vercel.app · OPENAI GAME BUILDERS SEOUL', width / 2, height - 42)

  // 다운로드 실행
  const dataUrl = canvas.toDataURL('image/png')
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = `dust-town-gazette-round-${round}-${opponent.name}.png`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

/** 캡션이 사진 틀보다 길어지지 않게 자른다 */
function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function drawDoubleLine(ctx: CanvasRenderingContext2D, x1: number, x2: number, y: number) {
  ctx.strokeStyle = '#2b1b12'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x1, y - 2)
  ctx.lineTo(x2, y - 2)
  ctx.moveTo(x1, y + 2)
  ctx.lineTo(x2, y + 2)
  ctx.stroke()
}

function drawCornerDecor(ctx: CanvasRenderingContext2D, x: number, y: number, corner: number) {
  ctx.save()
  ctx.translate(x, y)
  const angle = ((corner - 1) * Math.PI) / 2
  ctx.rotate(angle)
  ctx.strokeStyle = '#3d2517'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(16, 0)
  ctx.moveTo(0, 0)
  ctx.lineTo(0, 16)
  ctx.stroke()
  ctx.restore()
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word
    const metrics = ctx.measureText(testLine)
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine)
      currentLine = word
    } else {
      currentLine = testLine
    }
  }
  if (currentLine) lines.push(currentLine)
  return lines
}
