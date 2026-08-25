import { createSurface, isWebGLAvailable } from './glcore'

/**
 * 결투 화면 위에 얹는 포스트프로세싱 레이어.
 *
 * 2D 캔버스를 텍스처로 받아 색수차 · 방사형 블러 · 블룸 · 아지랑이를 입힌 뒤
 * 같은 자리에 불투명하게 덮는다. 원본 캔버스는 그대로 두므로 포인터 입력과
 * 적중 판정은 전혀 건드리지 않고, WebGL을 못 쓰면 이 레이어만 빠진다.
 *
 * 조준에 영향을 주지 않도록 강한 왜곡(블러)은 판정이 끝난 뒤에만 건다.
 */

export const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

varying vec2 vUv;
uniform sampler2D uScene;
uniform vec2 uRes;
uniform vec2 uFocus;
uniform float uTime;
uniform float uAberr;
uniform float uBlur;
uniform float uFlash;
uniform float uShimmer;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  vec2 uv = vUv;

  // 지평선 부근에 늘 깔려 있는 열기 아지랑이
  float band = smoothstep(0.20, 0.0, abs(uv.y - 0.45));
  uv.x += sin(uv.y * 120.0 - uTime * 1.4) * band * uShimmer;

  // 시네마 바와 화면 가장자리는 왜곡하지 않는다. 번지면 프레임이 무너진다.
  float edge = smoothstep(0.0, 0.13, vUv.y) * smoothstep(1.0, 0.87, vUv.y);

  vec2 c = uv - uFocus;
  float aberr = uAberr * edge;
  float blur = uBlur * edge;
  float ab = aberr * 0.006;

  vec3 col;
  if (ab < 0.0002 && blur < 0.004) {
    col = texture2D(uScene, uv).rgb;
  } else {
    col = vec3(0.0);
    for (int i = 0; i < 6; i++) {
      float k = float(i) / 5.0;
      vec2 base = uFocus + c * (1.0 - k * blur * 0.030);
      float a = ab * (0.35 + k);
      col.r += texture2D(uScene, base + c * a).r;
      col.g += texture2D(uScene, base).g;
      col.b += texture2D(uScene, base - c * a).b;
    }
    col /= 6.0;
  }

  // 총구 화염만 번지게 한다. 노을(휘도 ~0.63)은 문턱 아래로 확실히 빼야
  // 지평선 위로 가로 띠가 생기지 않는다.
  if (uFlash > 0.004) {
    vec3 b = vec3(0.0);
    for (int i = 0; i < 6; i++) {
      float a = float(i) * 1.0472;
      vec2 o = vec2(cos(a), sin(a)) * 0.016 * (1.0 + uFlash);
      b += texture2D(uScene, uv + o).rgb;
    }
    b /= 6.0;
    float lum = dot(b, vec3(0.299, 0.587, 0.114));
    col += b * vec3(1.0, 0.80, 0.50) * smoothstep(0.82, 0.99, lum) * uFlash * 1.8;
  }

  // 충격이 클수록 시야가 좁아진다
  vec2 q = vUv - 0.5;
  col *= 1.0 - dot(q, q) * (0.14 + uBlur * 0.30);

  float g = hash21(vUv * uRes + fract(uTime) * 71.3) - 0.5;
  col += g * (0.018 + uBlur * 0.035);

  gl_FragColor = vec4(max(col, 0.0), 1.0);
}`

export type Kick = 'draw' | 'win' | 'lose'

export interface DuelFx {
  resize(cssW: number, cssH: number): void
  /** 매 프레임 2D 씬을 넘긴다 */
  render(scene: HTMLCanvasElement, nowMs: number): void
  kick(kind: Kick): void
  /** 방사형 블러가 모이는 지점. 캔버스 좌상단 기준 픽셀 좌표 */
  focusAt(x: number, y: number, w: number, h: number): void
  dispose(): void
}

const AMBIENT_ABERR = 0.05

export function createDuelFx(canvas: HTMLCanvasElement): DuelFx | null {
  if (!isWebGLAvailable()) return null
  const surface = createSurface(canvas, FRAG)
  if (!surface) return null

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const shimmer = reduced ? 0 : 0.0011

  let aberr = AMBIENT_ABERR
  let blur = 0
  let flash = 0
  let last = 0

  surface.set2f('uFocus', 0.5, 0.5)
  surface.set1f('uShimmer', shimmer)

  return {
    resize(cssW, cssH) {
      // 원본 캔버스와 픽셀 단위로 같은 자리를 덮어야 한다
      canvas.style.width = `${cssW}px`
      canvas.style.height = `${cssH}px`
      surface.resize(cssW, cssH, 1.5)
    },
    focusAt(x, y, w, h) {
      if (w <= 0 || h <= 0) return
      // 셰이더 UV는 아래가 0이라 y를 뒤집는다
      surface.set2f('uFocus', x / w, 1 - y / h)
    },
    kick(kind) {
      if (reduced) return
      if (kind === 'draw') {
        // 조준 중이므로 색수차만 살짝. 블러는 절대 걸지 않는다.
        aberr = Math.max(aberr, 0.7)
        flash = Math.max(flash, 0.25)
      } else if (kind === 'win') {
        aberr = Math.max(aberr, 0.9)
        flash = 0.9
        blur = 0.75
      } else {
        aberr = Math.max(aberr, 1.1)
        flash = 0.75
        blur = 0.7
      }
    },
    render(scene, nowMs) {
      const dt = last ? Math.min(0.05, (nowMs - last) / 1000) : 0.016
      last = nowMs

      aberr = AMBIENT_ABERR + (aberr - AMBIENT_ABERR) * Math.exp(-dt * 7)
      blur *= Math.exp(-dt * 2.2)
      flash *= Math.exp(-dt * 4)
      if (blur < 0.002) blur = 0
      if (flash < 0.002) flash = 0

      surface.set1f('uTime', nowMs / 1000)
      surface.set1f('uAberr', aberr)
      surface.set1f('uBlur', blur)
      surface.set1f('uFlash', flash)
      surface.bindCanvas('uScene', 0, scene)
      surface.draw()
    },
    dispose() {
      surface.dispose()
    },
  }
}
