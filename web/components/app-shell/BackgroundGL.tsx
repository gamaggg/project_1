'use client'

import { useEffect, useMemo, useRef } from 'react'
import { observeScreenActiveReleasing } from '@/lib/observeScreenActive'

// A small WebGL2 runner for the paid profile backgrounds (25.11.2026): one fragment shader per background, drawn over a
// dark surface, with a shared set of helpers (noise, colours mixed in OKLab, light that adds to the surface, film grain).
//
// The scenes it runs (lib/data/glScenes/*) are ported from the free backgrounds of shadcn.io — Gradient, Starfield and so
// on, https://www.shadcn.io/background — which the owner asked for «one to one», reading their source in his own signed-in
// account; their licence (https://www.shadcn.io/license) is proprietary and the owner accepted that for RANGE. The helpers
// below stand in for their engine (`Background Canvas`), which was not copied: they are written here to the same contract
// (names and meaning), so a scene's own code works unchanged.
//
// Paused off screen like the other live backgrounds; reduced motion holds one still frame; no WebGL2 → nothing is drawn
// and the panel keeps its CSS gradient (HeroBackground.base).

export const GL_VERTEX = `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`

export const GL_PRELUDE = `#version 300 es
precision highp float;
precision highp int;
uniform vec2 uResolution;
uniform float uTime;
uniform float uIntro;
uniform float uPixelRatio;
uniform float uDark;
uniform float uGrain;
uniform vec3 uPointer;
uniform vec3 uSurface;
// The glyph atlas (Matrix): one square per character, the glyph in the alpha channel; and the click pulses (unused here).
uniform sampler2D uAtlas;
uniform float uAtlasCount;
uniform vec4 uPulses[4];
out vec4 fragColor;
#define TAU 6.283185307179586

mat2 rotate(float a) { float c = cos(a); float s = sin(a); return mat2(c, -s, s, c); }
// The box with its shorter side spanning 1, centred.
vec2 fitted(vec2 frag) { return (frag - 0.5 * uResolution) / min(uResolution.x, uResolution.y); }
// Centred, in CSS pixels.
vec2 centered(vec2 frag) { return (frag - 0.5 * uResolution) / uPixelRatio; }
vec2 uvOf(vec2 frag) { return frag / uResolution; }

vec3 hash32(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yzz) * p3.zyx);
}
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float hash21(vec2 p) { return hash12(p); }
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
// Value noise in [0, 1].
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x), f.y);
}

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }
// 2D simplex noise in [-1, 1] (after Ian McEwan / Stefan Gustavson, MIT).
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
// Layered simplex noise, about [-1, 1].
float fbm(vec2 p, int octaves) {
  float v = 0.0;
  float a = 0.5;
  float n = 0.0;
  mat2 turn = rotate(0.5);
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    v += a * snoise(p);
    n += a;
    p = turn * p * 2.0 + vec2(17.3, 4.1);
    a *= 0.5;
  }
  return v / n;
}

vec3 toOklab(vec3 c) {
  vec3 lin = mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
  float l = pow(max(0.4122214708 * lin.r + 0.5363325363 * lin.g + 0.0514459929 * lin.b, 0.0), 1.0 / 3.0);
  float m = pow(max(0.2119034982 * lin.r + 0.6806995451 * lin.g + 0.1073969566 * lin.b, 0.0), 1.0 / 3.0);
  float s = pow(max(0.0883024619 * lin.r + 0.2817188376 * lin.g + 0.6299787005 * lin.b, 0.0), 1.0 / 3.0);
  return vec3(
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
  );
}
vec3 fromOklab(vec3 c) {
  float l_ = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  float m_ = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  float s_ = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
  float l = l_ * l_ * l_;
  float m = m_ * m_ * m_;
  float s = s_ * s_ * s_;
  vec3 lin = clamp(vec3(
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  ), 0.0, 1.0);
  return mix(lin * 12.92, 1.055 * pow(lin, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, lin));
}
// The palette from t = 0 to 1, mixed in OKLab so two far hues meet in a clean colour.
vec3 ramp(vec3 colors[8], int count, float t) {
  float f = clamp(t, 0.0, 1.0) * float(max(count - 1, 1));
  int i = int(min(floor(f), float(max(count - 2, 0))));
  return fromOklab(mix(toOklab(colors[i]), toOklab(colors[min(i + 1, count - 1)]), f - float(i)));
}
// Two colours mixed in OKLab.
vec3 mixColor(vec3 a, vec3 b, float t) { return fromOklab(mix(toOklab(a), toOklab(b), t)); }
// Light: adds to a dark surface, tints a light one. Paint: covers it. Both premultiplied.
vec4 glow(vec3 color, float amount) { return vec4(color * amount, amount * (1.0 - uDark)); }
vec4 paint(vec3 color, float amount) { return vec4(color * amount, amount); }
vec4 over(vec4 a, vec4 b) { return a + b * (1.0 - a.a); }
`

const MAIN = `
void main() {
  vec4 c = scene(gl_FragCoord.xy);
  vec3 rgb = c.rgb + uSurface * (1.0 - clamp(c.a, 0.0, 1.0));
  float g = hash12(gl_FragCoord.xy + floor(uTime * 24.0) * 3.7) - 0.5;
  rgb += g * uGrain * 0.12;
  fragColor = vec4(clamp(rgb, 0.0, 1.0), 1.0);
}
`

export function hexToRgb01(color: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(color)
  const n = m ? parseInt(m[1], 16) : 0
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    if (process.env.NODE_ENV !== 'production') console.error('BackgroundGL shader:', gl.getShaderInfoLog(sh))
    return null
  }
  return sh
}

export type BackgroundGLProps = {
  // The scene's GLSL: its uniforms and `vec4 scene(vec2 frag)`.
  scene: string
  // Float uniforms.
  numbers?: Record<string, number>
  // vec2 uniforms.
  vec2s?: Record<string, [number, number]>
  // vec3 uniforms given as «#rrggbb».
  colors?: Record<string, string>
  // Palettes: `vec3 name[8]` + `int nameCount`.
  palettes?: Record<string, string[]>
  // The dark surface the scene is drawn over.
  surface?: string
  grain?: number
  // How fast it moves (1 = as written).
  speed?: number
  // The moment a still frame shows with reduced motion.
  still?: number
  // The characters of the glyph atlas (a scene that draws text, like Matrix).
  atlas?: string
  // One still frame and no loop (the shop's cards: seven live canvases on one tab would be a lot for a phone).
  frozen?: boolean
}

export function BackgroundGL({ scene, numbers, vec2s, colors, palettes, surface = '#05070D', grain = 0, speed = 1, still = 8, atlas, frozen = false }: BackgroundGLProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const key = JSON.stringify([numbers, vec2s, colors, palettes, surface, grain, speed])
  const params = useMemo(
    () => ({ numbers, vec2s, colors, palettes, surface, grain, speed }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the values are read through `key`
    [key],
  )
  const paramsRef = useRef(params)
  const redrawRef = useRef<(() => void) | null>(null)
  useEffect(() => {
    paramsRef.current = params
    redrawRef.current?.()
  }, [params])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = canvas?.parentElement
    const gl = canvas?.getContext('webgl2', { antialias: false })
    if (!canvas || !container || !gl) return

    const vs = compile(gl, gl.VERTEX_SHADER, GL_VERTEX)
    const fs = compile(gl, gl.FRAGMENT_SHADER, GL_PRELUDE + scene + MAIN)
    if (!vs || !fs) return
    const prog = gl.createProgram()!
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return
    gl.useProgram(prog)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'a_pos')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

    // The glyph atlas: a row of squares, each with one character in white; its alpha is the glyph.
    let atlasTex: WebGLTexture | null = null
    let atlasCount = 1
    if (atlas) {
      const chars = Array.from(atlas)
      const cell = 32
      const c = document.createElement('canvas')
      c.width = chars.length * cell
      c.height = cell
      const g = c.getContext('2d')!
      g.fillStyle = '#fff'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.font = `700 ${Math.round(cell * 0.72)}px "Hiragino Kaku Gothic ProN","Noto Sans JP","Yu Gothic","Menlo","Consolas",monospace`
      chars.forEach((ch, i) => g.fillText(ch, i * cell + cell / 2, cell / 2 + 1))
      atlasTex = gl.createTexture()
      gl.bindTexture(gl.TEXTURE_2D, atlasTex)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c)
      gl.generateMipmap(gl.TEXTURE_2D)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      atlasCount = chars.length
    }

    const locs = new Map<string, WebGLUniformLocation | null>()
    const U = (name: string) => {
      if (!locs.has(name)) locs.set(name, gl.getUniformLocation(prog, name))
      return locs.get(name)!
    }

    const reduceMotion = frozen || window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // A soft image: no need for the full device resolution, which keeps the shaders cheap on phones.
    const dpr = Math.min(window.devicePixelRatio || 1, 1.25)
    let t = reduceMotion ? still : 8
    let intro = reduceMotion ? 1 : 0
    let last = 0
    let frameId = 0
    let running = false
    let active = false
    let sized = false
    // In the viewport: a long list of live cards runs only the ones on the screen.
    let visible = true

    function draw() {
      const p = paramsRef.current
      gl!.uniform1f(U('uTime'), t)
      gl!.uniform1f(U('uIntro'), intro)
      gl!.uniform1f(U('uPixelRatio'), dpr)
      gl!.uniform1f(U('uDark'), 1)
      gl!.uniform1f(U('uGrain'), p.grain)
      gl!.uniform3f(U('uPointer'), canvas!.width / 2, canvas!.height / 2, 0)
      gl!.uniform4fv(U('uPulses'), new Float32Array(16))
      if (atlasTex) {
        gl!.activeTexture(gl!.TEXTURE0)
        gl!.bindTexture(gl!.TEXTURE_2D, atlasTex)
        gl!.uniform1i(U('uAtlas'), 0)
        gl!.uniform1f(U('uAtlasCount'), atlasCount)
      }
      gl!.uniform3fv(U('uSurface'), hexToRgb01(p.surface))
      for (const [k, v] of Object.entries(p.numbers ?? {})) gl!.uniform1f(U(k), v)
      for (const [k, v] of Object.entries(p.vec2s ?? {})) gl!.uniform2f(U(k), v[0], v[1])
      for (const [k, v] of Object.entries(p.colors ?? {})) gl!.uniform3fv(U(k), hexToRgb01(v))
      for (const [k, list] of Object.entries(p.palettes ?? {})) {
        const arr = new Float32Array(24)
        list.slice(0, 8).forEach((c, i) => arr.set(hexToRgb01(c), i * 3))
        gl!.uniform3fv(U(k), arr)
        gl!.uniform1i(U(k + 'Count'), Math.max(2, Math.min(8, list.length)))
      }
      gl!.drawArrays(gl!.TRIANGLES, 0, 3)
    }
    function frame(now: number) {
      if (!running) return
      if (last) {
        const dt = Math.min((now - last) / 1000, 0.05)
        t += dt * paramsRef.current.speed
        intro = Math.min(1, intro + dt / 2.2)
      }
      last = now
      draw()
      frameId = requestAnimationFrame(frame)
    }
    function start() {
      if (running || !sized || !active || !visible || reduceMotion) return
      running = true
      last = 0
      frameId = requestAnimationFrame(frame)
    }
    function stop() {
      running = false
      cancelAnimationFrame(frameId)
    }
    function fit() {
      const w = canvas!.clientWidth
      const h = canvas!.clientHeight
      if (w === 0 || h === 0) return
      canvas!.width = Math.round(w * dpr)
      canvas!.height = Math.round(h * dpr)
      gl!.viewport(0, 0, canvas!.width, canvas!.height)
      gl!.uniform2f(U('uResolution'), canvas!.width, canvas!.height)
      sized = true
      draw()
      start()
    }
    redrawRef.current = () => {
      if (sized && !running) draw()
    }
    const ro = new ResizeObserver(fit)
    ro.observe(container)
    const stopWatching = observeScreenActiveReleasing(
      canvas,
      (a) => {
        active = a
        if (a) start()
        else stop()
      },
      fit,
    )
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible) start()
      else stop()
    })
    io.observe(canvas)
    return () => {
      redrawRef.current = null
      stop()
      ro.disconnect()
      stopWatching()
      io.disconnect()
      gl.deleteProgram(prog)
      gl.deleteBuffer(buf)
      if (atlasTex) gl.deleteTexture(atlasTex)
    }
  }, [scene, still, atlas, frozen])

  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', zIndex: -1 }} />
}
