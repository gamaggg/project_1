'use client'

import { useEffect, useMemo, useRef } from 'react'
import { observeScreenActiveReleasing } from '@/lib/observeScreenActive'

// «Северное сияние» (25.11.2026): curtains of light hung across the box, on one WebGL fragment shader.
//
// The `curtain` / `scene` functions below are ported from the «Aurora Background» of shadcn.io
// (https://www.shadcn.io/background/aurora, marked FREE there). The owner asked for it «one to one» and read the source
// off the page in his own signed-in account; shadcn.io's licence (https://www.shadcn.io/license) is a proprietary one —
// the owner knows this and accepted it for RANGE (25.11.2026). The helpers it leans on (simplex noise, a colour ramp mixed
// in OKLab, the final glow over a dark surface) are written here; they come from their engine, which was not copied.
// Paused off screen, like the other live backgrounds; with no WebGL the panel keeps its CSS gradient underneath.

export const AURORA_VERTEX = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`

export const AURORA_FRAGMENT = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uResolution;
uniform float uTime;
uniform float uIntro;
uniform vec3 uLab[8];
uniform float uCount;
uniform vec3 uSurface;
uniform float uAmplitude;
uniform float uFlip;
uniform float uHeight;
uniform float uIntensity;
uniform float uLayers;
uniform float uRays;
uniform float uReach;
uniform float uScale;

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

vec3 oklabToSrgb(vec3 c) {
  float l_ = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  float m_ = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  float s_ = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
  float l = l_ * l_ * l_;
  float m = m_ * m_ * m_;
  float s = s_ * s_ * s_;
  vec3 rgb = vec3(
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  );
  return pow(clamp(rgb, 0.0, 1.0), vec3(1.0 / 2.2));
}

// The palette from t = 0 (lower edge) to 1 (tips), mixed in OKLab so two far hues meet in a clean colour.
vec3 ramp(float t) {
  float f = clamp(t, 0.0, 1.0) * (uCount - 1.0);
  float seg = min(floor(f), uCount - 2.0);
  vec3 a = uLab[0];
  vec3 b = uLab[1];
  for (int i = 0; i < 7; i++) {
    if (float(i) == seg) {
      a = uLab[i];
      b = uLab[i + 1];
    }
  }
  return oklabToSrgb(mix(a, b, f - seg));
}

// One curtain: its lower edge waves across the box, and light hangs above it.
vec4 curtain(vec2 uv, float aspect, float i) {
  float t = uTime * 0.06;
  float x = (uv.x - 0.5) * aspect * uScale + i * 3.7;
  // The fold: where the lower edge sits, and how the curtain bunches.
  float fold = snoise(vec2(x * 0.55 + t * (0.6 + i * 0.25), t * 0.9 + i * 7.1));
  float fine = snoise(vec2(x * 1.7 - t * 0.8, t * 1.3 + i * 3.3));
  float edge = uHeight + (fold * 0.16 + fine * 0.05) * uAmplitude - i * 0.05;
  float h = uv.y - edge;
  // Rays: thin across, long upward, sheared by the fold so they gather in the bends.
  float rx = x * 7.0 + fold * 3.5;
  float streak = snoise(vec2(rx, uv.y * 0.35 - t * 1.6 + i)) * 0.6 + snoise(vec2(rx * 2.9, uv.y * 0.8 + t * 2.2)) * 0.4;
  float rays = mix(1.0, 0.35 + 1.25 * smoothstep(-0.55, 0.75, streak), uRays);
  // The curtain is brighter in places along its length.
  float lit = smoothstep(-0.7, 0.6, snoise(vec2(x * 0.35 - t * 0.5, i * 5.0 + t * 0.4)));
  float reach = max(uReach, 0.02) * (0.75 + 0.5 * lit);
  float body = smoothstep(-0.02, 0.05, h) * exp(-max(h, 0.0) / reach * 2.6);
  // A brighter hem right at the lower edge.
  float hem = exp(-abs(h - 0.02) * 55.0) * 0.35;
  float amount = (body + hem) * rays * (0.35 + 0.65 * lit);
  vec3 color = ramp(clamp(h / reach * 0.9 + fine * 0.08, 0.0, 1.0));
  return vec4(color, amount);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  if (uFlip > 0.5) uv.y = 1.0 - uv.y;
  float aspect = uResolution.x / uResolution.y;
  vec4 sum = vec4(0.0);
  for (int i = 0; i < 3; i++) {
    if (float(i) >= uLayers) break;
    vec4 c = curtain(uv, aspect, float(i));
    float w = i == 0 ? 1.0 : 0.6 / float(i);
    sum += vec4(c.rgb * c.a * w, c.a * w);
  }
  vec3 color = sum.a > 0.0 ? sum.rgb / sum.a : vec3(0.0);
  // The light rises from the edge as it first shows.
  float rise = smoothstep(0.0, 1.0, uIntro * 1.4 - (uv.y - uHeight) * 0.6);
  float amount = (1.0 - exp(-sum.a * 1.6)) * uIntensity * rise;
  // Over a dark surface the light adds to it.
  gl_FragColor = vec4(uSurface + color * amount * 1.2, 1.0);
}
`

// "#rrggbb" → OKLab (the ramp mixes there).
export function hexToOklab(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  const n = m ? parseInt(m[1], 16) : 0x22e584
  const lin = (c: number) => {
    const v = c / 255
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  }
  const r = lin((n >> 16) & 255)
  const g = lin((n >> 8) & 255)
  const b = lin(n & 255)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const mm = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * mm - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * mm + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * mm - 0.808675766 * s,
  ]
}

function hexToRgb01(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  const n = m ? parseInt(m[1], 16) : 0x04060c
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null
}

export const AURORA_COLORS = ['#22e584', '#19d3c5', '#4f7dff', '#a05cff']

export type AuroraGLProps = {
  colors?: string[]
  amplitude?: number
  height?: number
  intensity?: number
  layers?: number
  placement?: 'top' | 'bottom'
  rays?: number
  reach?: number
  scale?: number
  // How fast it moves (1 = the original pace).
  speed?: number
  // The dark surface the light is added to.
  surface?: string
  // One still frame and no loop (the shop's cards).
  frozen?: boolean
}

export function AuroraGL({ colors = AURORA_COLORS, amplitude = 1, height = 0.42, intensity = 1, layers = 2, placement = 'top', rays = 0.7, reach = 0.5, scale = 1, speed = 1, surface = '#05070D', frozen = false }: AuroraGLProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // The settings live in a ref the draw loop reads every frame: a slider moved by the player changes the light at once,
  // without rebuilding the program (which replayed the intro and made the picture blink).
  const key = colors.join(',')
  const lab = useMemo(() => {
    const list = colors.slice(0, 8)
    const a = new Float32Array(24)
    list.forEach((c, i) => a.set(hexToOklab(c), i * 3))
    return { data: a, count: Math.max(2, list.length) }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `colors` is read through `key`
  }, [key])
  const params = { lab, surface, amplitude, height, intensity, layers, placement, rays, reach, scale, speed }
  const paramsRef = useRef(params)
  const redrawRef = useRef<(() => void) | null>(null)
  useEffect(() => {
    paramsRef.current = params
    // A paused or still picture (reduced motion, off screen) has no loop to pick the change up.
    redrawRef.current?.()
  })

  useEffect(() => {
    const canvas = canvasRef.current
    const container = canvas?.parentElement
    const gl = canvas?.getContext('webgl', { antialias: false, premultipliedAlpha: false })
    if (!canvas || !container || !gl) return

    const vs = compile(gl, gl.VERTEX_SHADER, AURORA_VERTEX)
    const fs = compile(gl, gl.FRAGMENT_SHADER, AURORA_FRAGMENT)
    if (!vs || !fs) return
    const prog = gl.createProgram()!
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return
    gl.useProgram(prog)

    // One triangle covering the whole canvas.
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'a_pos')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

    const U = (n: string) => gl.getUniformLocation(prog, n)
    const uRes = U('uResolution')
    const uTime = U('uTime')
    const uIntro = U('uIntro')
    const uLab = U('uLab')
    const uCount = U('uCount')
    const uSurface = U('uSurface')
    const uAmplitude = U('uAmplitude')
    const uFlip = U('uFlip')
    const uHeight = U('uHeight')
    const uIntensity = U('uIntensity')
    const uLayers = U('uLayers')
    const uRays = U('uRays')
    const uReach = U('uReach')
    const uScale = U('uScale')

    const reduceMotion = frozen || window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // A soft image: no need for the full device resolution, which keeps the shader cheap on phones.
    const dpr = Math.min(window.devicePixelRatio || 1, 1.25)
    // Starts a few seconds in (and at a still frame of its own with reduced motion), like the other live backgrounds.
    let t = reduceMotion ? 12 : 8
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
      gl!.uniform3fv(uLab, p.lab.data)
      gl!.uniform1f(uCount, p.lab.count)
      gl!.uniform3fv(uSurface, hexToRgb01(p.surface))
      gl!.uniform1f(uAmplitude, p.amplitude)
      gl!.uniform1f(uFlip, p.placement === 'bottom' ? 1 : 0)
      gl!.uniform1f(uHeight, p.height)
      gl!.uniform1f(uIntensity, p.intensity)
      gl!.uniform1f(uLayers, p.layers)
      gl!.uniform1f(uRays, p.rays)
      gl!.uniform1f(uReach, p.reach)
      gl!.uniform1f(uScale, p.scale)
      gl!.uniform1f(uTime, t)
      gl!.uniform1f(uIntro, intro)
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
      gl!.uniform2f(uRes, canvas!.width, canvas!.height)
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
    }
  }, [frozen])

  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', zIndex: -1 }} />
}
