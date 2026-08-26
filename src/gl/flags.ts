/**
 * 연출 토글.
 *
 * 셰이더 하늘이 이상해 보이면 URL에 ?sky=css 를 붙여 즉시 CSS 하늘로 되돌린다.
 * 빌드로 되돌리려면 SKY_FX_DEFAULT만 false로 바꾸면 된다.
 */
const SKY_FX_DEFAULT = true

export function skyFxEnabled(): boolean {
  if (typeof window === 'undefined') return SKY_FX_DEFAULT
  const mode = new URLSearchParams(window.location.search).get('sky')
  if (mode === 'css' || mode === 'off') return false
  if (mode === 'gl' || mode === 'on') return true
  return SKY_FX_DEFAULT
}

/** 대치 화면 상대 초상화. ?face=off 로 끈다. */
const STANDOFF_PORTRAIT_DEFAULT = true

export function standoffPortraitEnabled(): boolean {
  return flag('face', STANDOFF_PORTRAIT_DEFAULT)
}

/** 신문 하프톤 초상화. ?press=off 로 끈다. */
const PRESS_PORTRAIT_DEFAULT = true

export function pressPortraitEnabled(): boolean {
  return flag('press', PRESS_PORTRAIT_DEFAULT)
}

function flag(key: string, fallback: boolean): boolean {
  if (typeof window === 'undefined') return fallback
  const mode = new URLSearchParams(window.location.search).get(key)
  if (mode === 'off' || mode === '0') return false
  if (mode === 'on' || mode === '1') return true
  return fallback
}
