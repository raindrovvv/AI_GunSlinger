import { useEffect, useRef } from 'react'
import { createSurface, isWebGLAvailable } from './glcore'

/**
 * 타이틀 화면 배경.
 *
 * 기존 CSS 그라데이션 레이어를 대체한다. WebGL이 없으면 아무것도 그리지 않고
 * onReady(false)를 돌려주므로 CSS 폴백이 그대로 남는다.
 */

export const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

varying vec2 vUv;
uniform vec2 uRes;
uniform float uTime;
uniform float uHorizon;
uniform float uMotion;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) {
    s += a * vnoise(p);
    p *= 2.02;
    a *= 0.5;
  }
  return s;
}

void main() {
  float asp = uRes.x / max(uRes.y, 1.0);
  float t = uTime * uMotion;

  // 지평선에 가까울수록 강해지는 열기 아지랑이
  vec2 uv = vUv;
  float band = smoothstep(0.34, 0.0, abs(uv.y - uHorizon));
  float haze = sin(uv.y * 150.0 - t * 1.6) * 0.5 + sin(uv.y * 61.0 + t * 1.1) * 0.5;
  uv.x += haze * band * 0.0035;
  uv.y += sin(uv.x * 40.0 + t * 0.9) * band * 0.0012;

  float y = uv.y - uHorizon;

  vec3 night = vec3(0.043, 0.036, 0.078);
  vec3 dusk = vec3(0.29, 0.11, 0.10);
  vec3 ember = vec3(0.95, 0.45, 0.13);
  vec3 col = mix(dusk, night, smoothstep(0.05, 0.62, y));
  col = mix(ember, col, smoothstep(-0.02, 0.20, y));
  // 지평선 아래는 거의 검게 눌러야 건물 실루엣이 살아난다
  col = mix(vec3(0.055, 0.036, 0.026), col, smoothstep(-0.05, 0.004, y));

  // 태양
  vec2 sp = vec2((uv.x - 0.5) * asp, y);
  float d = length(sp);
  float sunR = 0.082;
  float flick = 1.0 + 0.025 * sin(t * 3.1) + 0.015 * sin(t * 7.7);
  float disc = smoothstep(sunR * flick, sunR * flick * 0.55, d);
  float halo = exp(-d * 6.5) * 0.85 + exp(-d * 2.0) * 0.30;
  col += vec3(1.0, 0.82, 0.55) * halo * 0.95;
  col = mix(col, vec3(1.0, 0.90, 0.68), disc * 0.85);

  // 태양에서 뻗는 빛줄기
  float ang = atan(sp.y, sp.x);
  float rays = fbm(vec2(ang * 3.4, t * 0.05)) - 0.56;
  col += vec3(1.0, 0.70, 0.34) * max(rays, 0.0) * exp(-d * 3.4) * 0.60 * step(0.0, y);

  // 길게 늘어진 구름 띠
  float cl = fbm(vec2(uv.x * 2.4 + t * 0.012, y * 9.0));
  float clMask = smoothstep(0.10, 0.34, y) * smoothstep(0.72, 0.34, y);
  float cloud = smoothstep(0.52, 0.78, cl) * clMask;
  col = mix(col, vec3(0.42, 0.24, 0.22), cloud * 0.55);
  col += vec3(1.0, 0.66, 0.34) * cloud * exp(-d * 1.5) * 0.40;

  vec2 q = vUv - 0.5;
  col *= 1.0 - dot(q, q) * 0.85;

  float g = hash21(vUv * uRes + fract(t) * 91.7) - 0.5;
  col += g * 0.035;

  gl_FragColor = vec4(max(col, 0.0), 1.0);
}`

interface Props {
  /** GL이 실제로 켜졌는지 알려준다. CSS 폴백 레이어를 숨길지 판단하는 데 쓴다 */
  onReady?: (ok: boolean) => void
}

export function TitleFx({ onReady }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const readyRef = useRef(onReady)
  useEffect(() => {
    readyRef.current = onReady
  }, [onReady])

  useEffect(() => {
    const canvas = ref.current
    if (!canvas || !isWebGLAvailable()) {
      readyRef.current?.(false)
      return
    }

    const surface = createSurface(canvas, FRAG)
    if (!surface) {
      readyRef.current?.(false)
      return
    }
    readyRef.current?.(true)

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    surface.set1f('uMotion', reduced ? 0 : 1)

    let raf = 0
    const start = performance.now()

    const sync = () => {
      const parent = canvas.parentElement
      const w = canvas.clientWidth || parent?.clientWidth || window.innerWidth
      const h = canvas.clientHeight || parent?.clientHeight || window.innerHeight
      surface.resize(w, h, 1.5)

      // 태양을 기존 지평선 띠(.title-horizon) 높이에 맞춘다.
      // 그래야 스카이라인 건물이 역광 실루엣으로 앉는다.
      const marker =
        parent?.querySelector('.title-horizon') ?? parent?.querySelector('.title-skyline')
      let horizon = 0.15
      if (marker) {
        const cr = canvas.getBoundingClientRect()
        const mr = marker.getBoundingClientRect()
        if (cr.height > 0) horizon = (cr.bottom - mr.bottom) / cr.height
      }
      surface.set1f('uHorizon', Math.min(0.5, Math.max(0.02, horizon)))
    }

    sync()
    const ro = new ResizeObserver(sync)
    if (canvas.parentElement) ro.observe(canvas.parentElement)
    window.addEventListener('resize', sync)

    const frame = () => {
      if (!document.hidden) {
        surface.set1f('uTime', (performance.now() - start) / 1000)
        surface.draw()
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('resize', sync)
      surface.dispose()
    }
  }, [])

  return <canvas ref={ref} className="title-fx" aria-hidden />
}
