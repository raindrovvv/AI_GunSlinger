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
