import type { ReactNode } from 'react'
import type { PerkId } from '../types'

interface Props {
  id: PerkId
  size?: number
}

/**
 * 전리품 아이콘.
 *
 * 수배서 판화 느낌을 맞추려고 선 대신 굵은 실루엣 위주로 그린다.
 * 작은 크기(14px)에서도 형태가 뭉개지지 않아야 하기 때문이다.
 */
export function PerkIcon({ id, size = 50 }: Props) {
  return (
    <svg
      className="perk-icon"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-hidden
    >
      <circle className="perk-icon-plate" cx="32" cy="32" r="30" />
      <circle className="perk-icon-ring" cx="32" cy="32" r="27" />
      <g className="perk-icon-art">{ART[id]}</g>
    </svg>
  )
}

const ART: Record<PerkId, ReactNode> = {
  // 매의 눈 — 십자선이 겹친 눈
  keen: (
    <>
      <path
        d="M13 32 Q32 17 51 32 Q32 47 13 32 Z"
        fill="none"
        strokeWidth="3.4"
        stroke="currentColor"
      />
      <circle cx="32" cy="32" r="8" fill="currentColor" opacity="0.32" />
      <circle cx="32" cy="32" r="4.2" fill="currentColor" />
      <g strokeWidth="2.8" stroke="currentColor" strokeLinecap="round">
        <path d="M32 14 V19" />
        <path d="M32 45 V50" />
        <path d="M14 32 H10" />
        <path d="M54 32 H50" />
      </g>
    </>
  ),

  // 안정된 손 — 수평계 위에 놓인 흔들림 없는 손
  steady: (
    <>
      <g fill="currentColor">
        <rect x="22" y="14" width="5.5" height="15" rx="2.7" />
        <rect x="29" y="11" width="5.5" height="18" rx="2.7" />
        <rect x="36" y="13" width="5.5" height="16" rx="2.7" />
        <rect x="43" y="17" width="5" height="12" rx="2.5" />
        <path d="M21 24 q-6 2 -5 8 l4 6 h5 z" />
        <path d="M21 26 h27 v9 a13.5 13.5 0 0 1 -27 0 z" />
      </g>
      <g stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
        <path d="M15 48 H49" />
      </g>
      <g stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" opacity="0.55">
        <path d="M19 53 V48" />
        <path d="M32 54 V48" />
        <path d="M45 53 V48" />
      </g>
    </>
  ),

  // 빠른 손 — 잔상을 남기는 번개
  fast: (
    <>
      <path d="M39 11 L21 34 H31 L27 53 L47 29 H36 Z" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.5">
        <path d="M11 24 H19" />
        <path d="M9 33 H17" />
        <path d="M12 42 H19" />
      </g>
    </>
  ),

  // 은장식 총 — 손잡이에 별이 박힌 리볼버 (우측을 향함)
  silver: (
    <>
      <g fill="currentColor">
        {/* 총열 */}
        <rect x="28" y="24" width="24" height="6" rx="1.5" />
        <rect x="48" y="20.5" width="3.2" height="4" rx="1" />
        {/* 프레임 · 실린더 */}
        <rect x="16" y="20" width="18" height="12" rx="2" />
        <circle cx="25" cy="26" r="6.2" />
        {/* 해머 */}
        <path d="M17 21 L12 15.5 L18.5 17 Z" />
        {/* 손잡이 */}
        <path d="M18.5 32 q-3.5 8 -2 17 h9.5 q0.2 -10 2.2 -17 z" />
      </g>
      <circle cx="25" cy="26" r="2.6" className="perk-icon-hole" />
      {/* 손잡이 은장식 별 */}
      <path
        d="M22.8 36.5 l1.4 3.6 3.8 .15 -3 2.5 1.1 3.7 -3.3 -2.2 -3.3 2.2 1.1 -3.7 -3 -2.5 3.8 -.15 z"
        className="perk-icon-hole"
      />
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.7">
        <path d="M43 14 V18" />
        <path d="M41 16 H45" />
      </g>
    </>
  ),

  // 낡은 부적 — 못자국이 남은 편자
  charm: (
    <>
      <path
        d="M19 50 V33 a13 13 0 0 1 26 0 V50 h-6 V33 a7 7 0 0 0 -14 0 V50 Z"
        fill="currentColor"
      />
      <g className="perk-icon-hole">
        <circle cx="22" cy="38" r="2.2" />
        <circle cx="22" cy="45" r="2.2" />
        <circle cx="42" cy="38" r="2.2" />
        <circle cx="42" cy="45" r="2.2" />
      </g>
      {/* 편자 끝을 막는 굽 */}
      <g fill="currentColor" opacity="0.85">
        <rect x="17" y="50" width="10" height="4" rx="1.5" />
        <rect x="37" y="50" width="10" height="4" rx="1.5" />
      </g>
    </>
  ),
}
