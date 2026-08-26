export type Mood = 'calm' | 'angered' | 'intimidated' | 'scared' | 'suspicious'

export const MOODS: Mood[] = ['calm', 'angered', 'intimidated', 'scared', 'suspicious']

/** mood별 허용 수치 범위. 프롬프트 안내와 서버 클램프가 같은 표를 쓴다. */
export const MOOD_RANGES: Record<
  Mood,
  { reaction: [number, number]; accuracy: [number, number]; note: string }
> = {
  calm: {
    reaction: [-20, 5],
    accuracy: [0, 0.08],
    note: '플레이어의 말이 시시했다. 상대는 오히려 집중한다 → 플레이어 불리',
  },
  angered: {
    reaction: [-50, -15],
    accuracy: [-0.2, -0.08],
    note: '도발에 격분. 드로우는 빨라지지만 조준이 흔들린다 → 트레이드오프',
  },
  intimidated: {
    reaction: [25, 70],
    accuracy: [-0.08, -0.02],
    note: '기세에 눌림. 손이 무거워진다 → 플레이어 유리',
  },
  scared: {
    reaction: [60, 120],
    accuracy: [-0.18, -0.06],
    note: '공포. 드물게만 허용 → 플레이어 크게 유리',
  },
  suspicious: {
    reaction: [15, 50],
    accuracy: [-0.1, -0.03],
    note: '텔을 간파당해 동요 → 플레이어 유리',
  },
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export function coerceMood(input: unknown): Mood {
  return MOODS.includes(input as Mood) ? (input as Mood) : 'calm'
}

/** 범위 중간값. 오프라인 폴백이 서버 클램프와 같은 표를 쓰게 한다. */
export function defaultMoodDeltas(mood: Mood) {
  const range = MOOD_RANGES[mood]
  return {
    reactionDeltaMs: Math.round((range.reaction[0] + range.reaction[1]) / 2),
    accuracyDelta: Number(((range.accuracy[0] + range.accuracy[1]) / 2).toFixed(3)),
  }
}

export function coerceDeltas(mood: Mood, reaction: unknown, accuracy: unknown) {
  const range = MOOD_RANGES[mood]
  const rNum = Number(reaction)
  const aNum = Number(accuracy)
  const mid = defaultMoodDeltas(mood)

  return {
    reactionDeltaMs: Math.round(
      clamp(Number.isFinite(rNum) ? rNum : mid.reactionDeltaMs, range.reaction[0], range.reaction[1]),
    ),
    accuracyDelta: Number(
      clamp(Number.isFinite(aNum) ? aNum : mid.accuracyDelta, range.accuracy[0], range.accuracy[1]).toFixed(3),
    ),
  }
}

export function moodGuideText() {
  return MOODS.map((m) => {
    const r = MOOD_RANGES[m]
    return `- ${m}: reactionDeltaMs [${r.reaction[0]}, ${r.reaction[1]}], accuracyDelta [${r.accuracy[0]}, ${r.accuracy[1]}]`
  }).join('\n')
}

/**
 * 평화 엔딩 게이트.
 * 마지막 턴 + 설득에 맞는 심리 상태 + 라운드가 낮을수록 관대.
 */
export function peaceAllowed(round: number, turn: number, mood: Mood) {
  if (turn < 3) return false
  if (round <= 3) return mood === 'scared' || mood === 'intimidated' || mood === 'suspicious'
  if (round <= 6) return mood === 'scared' || mood === 'intimidated'
  return mood === 'scared'
}
