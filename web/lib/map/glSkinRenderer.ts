// The real shaders of the paid live backgrounds, as the pattern for the sector skins (25.11.2026; owner: «why don't the
// textures look like the backgrounds — take the pattern the background itself gives»). One hidden canvas per family
// draws the background's own scene — the same GLSL the profile background runs (BackgroundGL / AuroraGL) — and every
// sector copies a piece of it (a different piece per sector, by its seed). No dark ground: the scenes are run in their
// light-surface mode (uDark = 0, a white surface), where light becomes ink, and the output keeps only the scene's own
// coverage as alpha, so the sector shows through and keeps its colour. Only the pattern's density is kept (the washes of
// light behind it are cut off, so the map under the sector stays readable) and it is inked in the sector's own colour,
// like the other skins. Returns false when WebGL is not there (the caller draws its flat 2D version then).
import { GL_PRELUDE, GL_VERTEX, hexToRgb01 } from '@/components/app-shell/BackgroundGL'
import { AURORA_FRAGMENT, AURORA_VERTEX, hexToOklab } from '@/components/app-shell/AuroraGL'
import { STARFIELD_PRESETS, STARFIELD_SCENE, starfieldUniforms } from '@/lib/data/glScenes/starfield'
import { PARTICLES_PRESETS, PARTICLES_SCENE, particlesUniforms } from '@/lib/data/glScenes/particles'
import { BEAMS_PRESETS, BEAMS_SCENE, beamsUniforms } from '@/lib/data/glScenes/beams'
import { MATRIX_PRESETS, MATRIX_SCENE, matrixUniforms } from '@/lib/data/glScenes/matrix'

export type GlSkinFamily = 'aurora' | 'starfield' | 'particles' | 'beams' | 'matrix'

// The hidden canvas, bigger than a sector's picture so each sector can take its own piece.
const W = 540
const H = 468
// A sector's piece of it, in canvas pixels (smaller = the pattern bigger in the sector).
const PIECE_W = 225

type Uniforms = {
  numbers?: Record<string, number>
  vec2s?: Record<string, [number, number]>
  colors?: Record<string, string>
  palettes?: Record<string, string[]>
  atlas?: string
  speed?: number
}

// What the scene needs, with the output that keeps only the pattern: premultiplied colour, alpha = the scene's coverage,
// lifted so the ink reads on a tinted sector.
const MAIN_SKIN = `
void main() {
  vec4 c = scene(gl_FragCoord.xy);
  float a0 = clamp(c.a, 0.0, 1.0);
  // Only the pattern: the faint washes of light go, the marks stay (the colour is the sector's, put on afterwards).
  float a = smoothstep(0.1, 0.48, pow(a0, 0.5));
  fragColor = vec4(0.0, 0.0, 0.0, a);
}
`

type Renderer = {
  canvas: HTMLCanvasElement
  render: (t: number) => void
  lastT: number
  // Lets the graphics context go (a phone allows only a handful of them at once).
  dispose: () => void
  idle?: ReturnType<typeof setTimeout>
}

const renderers = new Map<GlSkinFamily, Renderer | 'failed'>()
// One scratch canvas for the tinting, shared by all sectors.
let tint: HTMLCanvasElement | null = null

// The sector's colour darkened by k (0 = as is, 1 = black).
function shade(hex: string, k: number) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex)
  if (!m) return hex
  const n = parseInt(m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1], 16)
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * (1 - k)).toString(16).padStart(2, '0')).join('')
}

function compile(gl: WebGLRenderingContext | WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null
}

// The glyph atlas of the matrix scene: a row of squares, one character each, the glyph in the alpha channel.
function glyphAtlas(chars: string): HTMLCanvasElement {
  const list = Array.from(chars)
  const cell = 32
  const c = document.createElement('canvas')
  c.width = list.length * cell
  c.height = cell
  const g = c.getContext('2d')!
  g.fillStyle = '#fff'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = `700 ${Math.round(cell * 0.72)}px "Hiragino Kaku Gothic ProN","Noto Sans JP","Yu Gothic","Menlo","Consolas",monospace`
  list.forEach((ch, i) => g.fillText(ch, i * cell + cell / 2, cell / 2 + 1))
  return c
}

function makeSceneRenderer(scene: string, u: Uniforms): Renderer | null {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: true, alpha: true, preserveDrawingBuffer: true })
  if (!gl) return null
  const vs = compile(gl, gl.VERTEX_SHADER, GL_VERTEX)
  const fs = compile(gl, gl.FRAGMENT_SHADER, GL_PRELUDE + scene + MAIN_SKIN)
  if (!vs || !fs) return null
  const prog = gl.createProgram()!
  gl.attachShader(prog, vs)
  gl.attachShader(prog, fs)
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null
  gl.useProgram(prog)
  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const loc = gl.getAttribLocation(prog, 'a_pos')
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
  gl.viewport(0, 0, W, H)

  let atlasTex: WebGLTexture | null = null
  let atlasCount = 1
  if (u.atlas) {
    const a = glyphAtlas(u.atlas)
    atlasTex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, atlasTex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, a)
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    atlasCount = Array.from(u.atlas).length
  }
  const locs = new Map<string, WebGLUniformLocation | null>()
  const U = (name: string) => {
    if (!locs.has(name)) locs.set(name, gl.getUniformLocation(prog, name))
    return locs.get(name)!
  }
  const speed = u.speed ?? 1

  const r: Renderer = {
    canvas,
    lastT: -1,
    dispose() {
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    },
    render(t: number) {
      gl.useProgram(prog)
      gl.uniform2f(U('uResolution'), W, H)
      // Started a few seconds in, like the profile background, fully shown, in the light-surface mode.
      gl.uniform1f(U('uTime'), 8 + t * speed)
      gl.uniform1f(U('uIntro'), 1)
      gl.uniform1f(U('uPixelRatio'), 1)
      gl.uniform1f(U('uDark'), 0)
      gl.uniform1f(U('uGrain'), 0)
      gl.uniform3f(U('uPointer'), W / 2, H / 2, 0)
      gl.uniform4fv(U('uPulses'), new Float32Array(16))
      gl.uniform3fv(U('uSurface'), [1, 1, 1])
      if (atlasTex) {
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, atlasTex)
        gl.uniform1i(U('uAtlas'), 0)
        gl.uniform1f(U('uAtlasCount'), atlasCount)
      }
      for (const [k, v] of Object.entries(u.numbers ?? {})) gl.uniform1f(U(k), v)
      for (const [k, v] of Object.entries(u.vec2s ?? {})) gl.uniform2f(U(k), v[0], v[1])
      for (const [k, v] of Object.entries(u.colors ?? {})) gl.uniform3fv(U(k), hexToRgb01(v))
      for (const [k, list] of Object.entries(u.palettes ?? {})) {
        const arr = new Float32Array(24)
        list.slice(0, 8).forEach((c, i) => arr.set(hexToRgb01(c), i * 3))
        gl.uniform3fv(U(k), arr)
        gl.uniform1i(U(k + 'Count'), Math.max(2, Math.min(8, list.length)))
      }
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    },
  }
  return r
}

// The aurora has its own (WebGL1) shader: deeper colours so the curtains are ink on a light sector, the same output rule.
const AURORA_DEEP = ['#0E9F5B', '#0A8F86', '#2B52D6', '#6B2FD6']
function makeAuroraRenderer(): Renderer | null {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: true, alpha: true, preserveDrawingBuffer: true })
  if (!gl) return null
  const fragment = AURORA_FRAGMENT.replace(
    'gl_FragColor = vec4(uSurface + color * amount * 1.2, 1.0);',
    'float a = smoothstep(0.06, 0.6, amount) * 0.9; gl_FragColor = vec4(0.0, 0.0, 0.0, a);',
  )
  const vs = compile(gl, gl.VERTEX_SHADER, AURORA_VERTEX)
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragment)
  if (!vs || !fs) return null
  const prog = gl.createProgram()!
  gl.attachShader(prog, vs)
  gl.attachShader(prog, fs)
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null
  gl.useProgram(prog)
  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const loc = gl.getAttribLocation(prog, 'a_pos')
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
  gl.viewport(0, 0, W, H)
  const lab = new Float32Array(24)
  AURORA_DEEP.forEach((c, i) => lab.set(hexToOklab(c), i * 3))
  const U = (n: string) => gl.getUniformLocation(prog, n)
  return {
    canvas,
    lastT: -1,
    dispose() {
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    },
    render(t: number) {
      gl.useProgram(prog)
      gl.uniform2f(U('uResolution'), W, H)
      gl.uniform3fv(U('uLab'), lab)
      gl.uniform1f(U('uCount'), AURORA_DEEP.length)
      gl.uniform3fv(U('uSurface'), [0, 0, 0])
      gl.uniform1f(U('uAmplitude'), 1)
      gl.uniform1f(U('uFlip'), 1)
      // The curtains hang up from the foot of the sector.
      gl.uniform1f(U('uHeight'), 0.12)
      gl.uniform1f(U('uIntensity'), 1)
      gl.uniform1f(U('uLayers'), 2)
      gl.uniform1f(U('uRays'), 0.8)
      gl.uniform1f(U('uReach'), 0.6)
      gl.uniform1f(U('uScale'), 1.3)
      gl.uniform1f(U('uTime'), 12 + t)
      gl.uniform1f(U('uIntro'), 1)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    },
  }
}

function build(family: GlSkinFamily): Renderer | null {
  switch (family) {
    case 'aurora':
      return makeAuroraRenderer()
    case 'starfield':
      return makeSceneRenderer(STARFIELD_SCENE, starfieldUniforms(STARFIELD_PRESETS[0].props))
    case 'particles':
      return makeSceneRenderer(PARTICLES_SCENE, particlesUniforms({ ...PARTICLES_PRESETS[0].props, count: 700, size: 6 }))
    case 'beams':
      return makeSceneRenderer(BEAMS_SCENE, beamsUniforms({ ...BEAMS_PRESETS[0].props, width: 3.4, count: 22 }))
    case 'matrix':
      return makeSceneRenderer(MATRIX_SCENE, matrixUniforms(MATRIX_PRESETS[0].props))
  }
}

// Draws the family's pattern into the sector's box (0,0)–(w,h) for time t; false = no WebGL, draw the flat version.
export function drawGlSkin(family: GlSkinFamily, ctx: CanvasRenderingContext2D, w: number, h: number, t: number, seed: number, color: string): boolean {
  if (typeof document === 'undefined') return false
  let r = renderers.get(family)
  if (r === 'failed') return false
  if (!r) {
    r = build(family) ?? 'failed'
    renderers.set(family, r)
    if (r === 'failed') return false
  }
  // One frame is drawn once and shared by every sector of the same moment.
  if (t !== r.lastT) {
    r.render(t)
    r.lastT = t
  }
  // Not drawn for a few seconds (no sector of this skin on screen): hand the context back; the next draw builds it again.
  const used = r
  if (used.idle) clearTimeout(used.idle)
  used.idle = setTimeout(() => {
    used.dispose()
    if (renderers.get(family) === used) renderers.delete(family)
  }, 4000)
  const sw = PIECE_W
  const sh = Math.min(H, Math.max(40, (PIECE_W * h) / w))
  const sx = (W - sw) * (seed % 1)
  const sy = (H - sh) * ((seed * 7.31) % 1)
  // The piece, kept as a mask and filled with the sector's colour (a deeper shade of it, as the other skins are inked).
  const cw = Math.ceil(w)
  const ch = Math.ceil(h)
  if (!tint) tint = document.createElement('canvas')
  if (tint.width < cw || tint.height < ch) {
    tint.width = Math.max(tint.width, cw)
    tint.height = Math.max(tint.height, ch)
  }
  const tc = tint.getContext('2d')!
  tc.globalCompositeOperation = 'source-over'
  tc.clearRect(0, 0, cw, ch)
  tc.drawImage(r.canvas, sx, sy, sw, sh, 0, 0, w, h)
  tc.globalCompositeOperation = 'source-in'
  tc.fillStyle = shade(color, 0.5)
  tc.fillRect(0, 0, cw, ch)
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 0.95
  ctx.drawImage(tint, 0, 0, cw, ch, 0, 0, w, h)
  ctx.globalAlpha = 1
  return true
}
