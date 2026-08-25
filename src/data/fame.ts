export interface FameInfo {
  grade: number
  title: string
  subtitle: string
  badge: string
  color: string
  promptDesc: string
}

export function getFameInfo(streak: number): FameInfo {
  if (streak >= 7) {
    return {
      grade: 5,
      title: '황야의 사신',
      subtitle: '황야의 절대자',
      badge: '👑 사신',
      color: '#ff5544',
      promptDesc: '7연승 이상의 무패 신화. 결투 전부터 상대를 압도하는 황야의 사신',
    }
  }
  if (streak >= 5) {
    return {
      grade: 4,
      title: '서부의 전설',
      subtitle: '살아있는 신화',
      badge: '💎 전설',
      color: '#44d8ff',
      promptDesc: '연달아 무법자들을 꺾어 소문만으로 상대를 떨게 만드는 서부의 전설',
    }
  }
  if (streak >= 3) {
    return {
      grade: 3,
      title: '침묵의 방아쇠',
      subtitle: '경계받는 명사수',
      badge: '🥇 명사수',
      color: '#ffd700',
      promptDesc: '연승 행진으로 마을의 무법자들도 깊이 경계하는 빠른 손의 총잡이',
    }
  }
  if (streak >= 2) {
    return {
      grade: 2,
      title: '더스트 타운의 총잡이',
      subtitle: '소문난 실력자',
      badge: '🥈 총잡이',
      color: '#c8d0e0',
      promptDesc: '최근 2연승으로 거리에서 총 꽤나 쏜다는 소문이 돌기 시작한 실력자',
    }
  }
  return {
    grade: 1,
    title: '풋내기 방랑자',
    subtitle: '이름 없는 떠돌이',
    badge: '🥉 방랑자',
    color: '#d4a373',
    promptDesc: '아직 이름이 널리 알려지지 않은 먼지투성이 떠돌이 총잡이',
  }
}
