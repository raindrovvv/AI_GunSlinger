import type { DrawGrade } from '../types'

export function gradeOf(ms: number): DrawGrade {
  if (ms <= 220) return 'S'
  if (ms <= 320) return 'A'
  if (ms <= 430) return 'B'
  return 'C'
}

export const GRADE_LABEL: Record<DrawGrade, string> = {
  S: '전광석화',
  A: '번개같이',
  B: '무난하게',
  C: '아슬아슬',
  '-': '',
}
