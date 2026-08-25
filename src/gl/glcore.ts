/**
 * 최소 WebGL 래퍼.
 *
 * three.js를 쓰지 않는다. 이 게임에 필요한 건 전체화면 사각형 하나에
 * 프래그먼트 셰이더를 굽는 것뿐이라 라이브러리가 필요 없다.
 * WebGL을 못 쓰는 환경에서는 null을 돌려주고, 호출부는 기존 2D 화면으로 폴백한다.
 */

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`

export interface GLSurface {
  gl: WebGLRenderingContext
  canvas: HTMLCanvasElement
  /** CSS 픽셀 기준 크기를 넘기면 dpr을 반영해 백버퍼를 맞춘다 */
  resize(cssW: number, cssH: number, maxDpr?: number): void
  set1f(name: string, v: number): void
  set2f(name: string, a: number, b: number): void
  /** 2D 캔버스를 텍스처로 올린다. unit은 0부터 */
  bindCanvas(name: string, unit: number, src: HTMLCanvasElement): void
  draw(): void
  dispose(): void
}

let supported: boolean | null = null

export function isWebGLAvailable(): boolean {
  if (supported !== null) return supported
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl', { failIfMajorPerformanceCaveat: false })
    supported = !!gl
  } catch {
    supported = false
  }
  return supported
}

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)
  if (!sh) return null
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn('[gl] shader compile failed', gl.getShaderInfoLog(sh))
    gl.deleteShader(sh)
    return null
  }
  return sh
}

export function createSurface(
  canvas: HTMLCanvasElement,
  fragSrc: string,
): GLSurface | null {
  const gl = (canvas.getContext('webgl', {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: true,
    powerPreference: 'low-power',
  }) ?? canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null
  if (!gl) return null

  const vs = compile(gl, gl.VERTEX_SHADER, VERT)
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragSrc)
  if (!vs || !fs) return null

  const prog = gl.createProgram()
  if (!prog) return null
  gl.attachShader(prog, vs)
  gl.attachShader(prog, fs)
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn('[gl] link failed', gl.getProgramInfoLog(prog))
    return null
  }
  gl.useProgram(prog)

  // 화면을 덮는 삼각형 하나. 사각형보다 프래그먼트가 덜 겹친다.
  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const loc = gl.getAttribLocation(prog, 'aPos')
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

  const uniforms = new Map<string, WebGLUniformLocation | null>()
  const u = (name: string) => {
    if (!uniforms.has(name)) uniforms.set(name, gl.getUniformLocation(prog, name))
    return uniforms.get(name) ?? null
  }

  const textures = new Map<number, WebGLTexture>()
  const texFor = (unit: number) => {
    let t = textures.get(unit)
    if (!t) {
      const created = gl.createTexture()
      if (!created) throw new Error('texture alloc failed')
      t = created
      textures.set(unit, t)
      gl.activeTexture(gl.TEXTURE0 + unit)
      gl.bindTexture(gl.TEXTURE_2D, t)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    }
    return t
  }

  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1)
  gl.disable(gl.DEPTH_TEST)
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

  return {
    gl,
    canvas,
    resize(cssW, cssH, maxDpr = 1.5) {
      const dpr = Math.min(window.devicePixelRatio || 1, maxDpr)
      const w = Math.max(1, Math.floor(cssW * dpr))
      const h = Math.max(1, Math.floor(cssH * dpr))
      // 표시 크기는 호출부가 CSS로 정한다. 여기서 style을 건드리면
      // ResizeObserver와 물려 캔버스가 계속 쪼그라든다.
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      gl.viewport(0, 0, w, h)
      gl.useProgram(prog)
      const r = u('uRes')
      if (r) gl.uniform2f(r, w, h)
    },
    set1f(name, v) {
      const l = u(name)
      if (l) gl.uniform1f(l, v)
    },
    set2f(name, a, b) {
      const l = u(name)
      if (l) gl.uniform2f(l, a, b)
    },
    bindCanvas(name, unit, src) {
      if (src.width === 0 || src.height === 0) return
      const t = texFor(unit)
      gl.activeTexture(gl.TEXTURE0 + unit)
      gl.bindTexture(gl.TEXTURE_2D, t)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src)
      const l = u(name)
      if (l) gl.uniform1i(l, unit)
    },
    draw() {
      gl.useProgram(prog)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    },
    dispose() {
      textures.forEach((t) => gl.deleteTexture(t))
      textures.clear()
      gl.deleteBuffer(buf)
      gl.deleteProgram(prog)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
      // loseContext()는 부르지 않는다. 캔버스는 재사용되고(StrictMode 재마운트,
      // 라운드마다 도는 Duel 이펙트), 한 번 잃은 컨텍스트에서는 셰이더가
      // 다시 컴파일되지 않는다.
    },
  }
}
