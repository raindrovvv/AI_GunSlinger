export interface HitLayout {
  enemyX: number
  headY: number
  bodyY: number
  headR: number
  bodyR: number
  s: number
}

export type HitZone = 'head' | 'body' | 'miss'

export function classifyHit(x: number, y: number, L: HitLayout): HitZone {
  const dHead = Math.hypot(x - L.enemyX, y - L.headY)
  if (dHead <= L.headR) return 'head'

  const dBody = Math.hypot(x - L.enemyX, y - (L.bodyY + 10 * L.s))
  const inBodyCapsule =
    Math.abs(x - L.enemyX) <= L.bodyR * 1.12 &&
    y >= L.headY - L.headR &&
    y <= L.bodyY + 68 * L.s

  if (dBody <= L.bodyR || inBodyCapsule) return 'body'
  return 'miss'
}
