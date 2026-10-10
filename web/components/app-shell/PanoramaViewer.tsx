'use client'

import { useEffect, useRef, useState } from 'react'

// A 360° panorama (an equirectangular picture) you turn with a finger and
// pinch to zoom — «Где это?»'s view and the admin's check. One WebGL quad:
// each pixel's ray is turned into longitude/latitude and looked up in the
// picture, so there's no sphere mesh and no library. It draws only when
// something moves. The small preview goes up first, the full one replaces it.
//
// Yaw is in degrees from the picture's centre, clockwise; `heading` is where
// the view opens. Until the first touch it turns slowly by itself so it's
// clear it's a panorama (not with «уменьшить движение»).

const VERT = `
attribute vec2 p;
varying vec2 v;
void main() { v = p; gl_Position = vec4(p, 0.0, 1.0); }
`
const FRAG = `
precision highp float;
uniform sampler2D tex;
uniform float aspect;
uniform float tanHalf;
uniform float yaw;
uniform float pitch;
varying vec2 v;
const float PI = 3.14159265358979;
void main() {
  vec3 d = normalize(vec3(v.x * aspect * tanHalf, v.y * tanHalf, 1.0));
  float cp = cos(pitch), sp = sin(pitch);
  d = vec3(d.x, d.y * cp + d.z * sp, -d.y * sp + d.z * cp);
  float cy = cos(yaw), sy = sin(yaw);
  d = vec3(d.x * cy + d.z * sy, d.y, -d.x * sy + d.z * cy);
  float lon = atan(d.x, d.z);
  float lat = asin(clamp(d.y, -1.0, 1.0));
  gl_FragColor = texture2D(tex, vec2(0.5 + lon / (2.0 * PI), 0.5 - lat / PI));
}
`

const FOV_MIN = 30
const FOV_MAX = 100
// The bottom of the picture is the photographer — the view stops above it.
const LOW_EDGE = -58
const HIGH_EDGE = 88
const rad = (d: number) => (d * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI

export function PanoramaViewer({
  src,
  preview,
  heading = 0,
  className,
  spin = true,
  onYawChange,
  onInteract,
}: {
  src: string
  preview?: string
  heading?: number
  className?: string
  // The slow turn until the first touch; the admin's check holds still, on
  // the view the players will open on.
  spin?: boolean
  onYawChange?: (yaw: number) => void
  onInteract?: () => void
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'fallback'>('loading')
  const [touched, setTouched] = useState(false)
  const onYawRef = useRef(onYawChange)
  const onInteractRef = useRef(onInteract)
  useEffect(() => {
    onYawRef.current = onYawChange
    onInteractRef.current = onInteract
  })

  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    // A canvas of its own for each run: the context is given back (lost) on
    // cleanup, and a lost context can't be picked up again from the same one.
    const canvas = document.createElement('canvas')
    canvas.className = 'pano-canvas'
    box.appendChild(canvas)
    const gl = (canvas.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: false }) as WebGLRenderingContext | null)
    // No WebGL here (or the shaders won't build): the flat picture instead,
    // switched to on the next frame — this answers the browser, not React.
    const fallback = () => {
      canvas.remove()
      const id = requestAnimationFrame(() => setState('fallback'))
      return () => cancelAnimationFrame(id)
    }
    if (!gl) return fallback()
    const compile = (type: number, code: string) => {
      const sh = gl.createShader(type)!
      gl.shaderSource(sh, code)
      gl.compileShader(sh)
      return sh
    }
    const prog = gl.createProgram()!
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return fallback()
    gl.useProgram(prog)
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'p')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    const u = {
      aspect: gl.getUniformLocation(prog, 'aspect'),
      tanHalf: gl.getUniformLocation(prog, 'tanHalf'),
      yaw: gl.getUniformLocation(prog, 'yaw'),
      pitch: gl.getUniformLocation(prog, 'pitch'),
    }
    const tex = gl.createTexture()
    const maxSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number

    const view = { yaw: rad(heading), pitch: 0, fov: 75 }
    const vel = { yaw: 0, pitch: 0 }
    const pointers = new Map<number, { x: number; y: number }>()
    let hasTexture = false
    let auto = spin && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let frame = 0
    let dirty = true
    let disposed = false

    function clampView() {
      view.fov = Math.min(FOV_MAX, Math.max(FOV_MIN, view.fov))
      const half = view.fov / 2
      view.pitch = Math.min(rad(HIGH_EDGE - half), Math.max(rad(LOW_EDGE + half), view.pitch))
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = Math.round(canvas!.clientWidth * dpr)
      const h = Math.round(canvas!.clientHeight * dpr)
      if (w && h && (canvas!.width !== w || canvas!.height !== h)) {
        canvas!.width = w
        canvas!.height = h
        dirty = true
      }
    }

    function draw() {
      frame = 0
      if (disposed) return
      // The glide is for after the finger lifts — while it's down, the view
      // just follows it.
      const moving = pointers.size === 0 && (Math.abs(vel.yaw) > 1e-5 || Math.abs(vel.pitch) > 1e-5)
      const visible = !document.hidden && !!canvas!.closest('.screen.active, .admin-geo')
      if (moving) {
        view.yaw += vel.yaw
        view.pitch += vel.pitch
        vel.yaw *= 0.9
        vel.pitch *= 0.9
        if (Math.abs(vel.yaw) < 1e-5 && Math.abs(vel.pitch) < 1e-5) {
          vel.yaw = vel.pitch = 0
          reportYaw()
        }
        dirty = true
      }
      if (auto && hasTexture && visible) {
        view.yaw += rad(0.06)
        dirty = true
      }
      clampView()
      if (dirty && hasTexture) {
        gl!.viewport(0, 0, canvas!.width, canvas!.height)
        gl!.uniform1f(u.aspect, canvas!.width / canvas!.height)
        gl!.uniform1f(u.tanHalf, Math.tan(rad(view.fov) / 2))
        gl!.uniform1f(u.yaw, view.yaw)
        gl!.uniform1f(u.pitch, view.pitch)
        gl!.drawArrays(gl!.TRIANGLES, 0, 3)
        dirty = false
      }
      if (moving || (auto && visible)) schedule()
    }
    function schedule() {
      if (!frame) frame = requestAnimationFrame(draw)
    }
    function reportYaw() {
      const y = ((deg(view.yaw) % 360) + 540) % 360 - 180
      onYawRef.current?.(Math.round(y * 10) / 10)
    }

    function upload(img: HTMLImageElement) {
      let source: TexImageSource = img
      if (img.naturalWidth > maxSize) {
        const c = document.createElement('canvas')
        c.width = maxSize
        c.height = maxSize / 2
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
        source = c
      }
      gl!.bindTexture(gl!.TEXTURE_2D, tex)
      gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGB, gl!.RGB, gl!.UNSIGNED_BYTE, source)
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR)
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR)
      // Our pictures are 4096×2048 / 1024×512 — powers of two, so they can
      // wrap round the seam behind the viewer without a line.
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.REPEAT)
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE)
      hasTexture = true
      dirty = true
      setState('ready')
      schedule()
    }
    function load(url: string) {
      return new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = url
      })
    }
    let fullDone = false
    if (preview) {
      load(preview)
        .then((img) => {
          if (!disposed && !fullDone) upload(img)
        })
        .catch(() => {})
    }
    load(src)
      .then((img) => {
        fullDone = true
        if (!disposed) upload(img)
      })
      .catch(() => {
        if (!disposed && !hasTexture) setState('fallback')
      })

    // Turning: a finger across the view's height turns it by the field of
    // view, so the picture stays under the finger. Two fingers zoom.
    let pinch: { dist: number; fov: number } | null = null
    let last = { x: 0, y: 0, t: 0 }
    function stopAuto() {
      if (auto) auto = false
      setTouched(true)
      onInteractRef.current?.()
    }
    function onDown(e: PointerEvent) {
      try {
        canvas!.setPointerCapture(e.pointerId)
      } catch {}
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      vel.yaw = vel.pitch = 0
      stopAuto()
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), fov: view.fov }
      }
      last = { x: e.clientX, y: e.clientY, t: performance.now() }
    }
    function onMove(e: PointerEvent) {
      const p = pointers.get(e.pointerId)
      if (!p) return
      const prev = { ...p }
      p.x = e.clientX
      p.y = e.clientY
      if (pointers.size >= 2 && pinch) {
        const [a, b] = [...pointers.values()]
        view.fov = pinch.fov * (pinch.dist / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)))
      } else {
        const k = rad(view.fov) / canvas!.clientHeight
        const dYaw = -(p.x - prev.x) * k
        const dPitch = (p.y - prev.y) * k
        view.yaw += dYaw
        view.pitch += dPitch
        const now = performance.now()
        const dt = Math.max(8, now - last.t)
        // Per-frame velocity (~16 ms) for the glide after letting go —
        // smoothed over the last moves and capped, so a flick turns the view
        // a little further, not round and round.
        const cap = rad(2.5)
        vel.yaw = Math.max(-cap, Math.min(cap, vel.yaw * 0.5 + ((dYaw * 16) / dt) * 0.5))
        vel.pitch = 0
        last = { x: p.x, y: p.y, t: now }
      }
      dirty = true
      schedule()
    }
    function onUp(e: PointerEvent) {
      pointers.delete(e.pointerId)
      if (pointers.size < 2) pinch = null
      if (pointers.size === 0) {
        // A finger that stopped before lifting doesn't glide.
        if (performance.now() - last.t > 80) vel.yaw = 0
        if (!vel.yaw) reportYaw()
        schedule()
      }
    }
    function onWheel(e: WheelEvent) {
      e.preventDefault()
      stopAuto()
      view.fov *= 1 + e.deltaY * 0.0012
      dirty = true
      schedule()
    }

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    const ro = new ResizeObserver(() => {
      resize()
      schedule()
    })
    ro.observe(canvas)
    resize()
    const onVisible = () => schedule()
    document.addEventListener('visibilitychange', onVisible)
    // The screen it sits on becoming active again restarts the slow turn.
    const mo = new MutationObserver(() => schedule())
    const screen = canvas.closest('.screen')
    if (screen) mo.observe(screen, { attributes: true, attributeFilter: ['class'] })
    const onLost = (e: Event) => {
      e.preventDefault()
      setState('fallback')
    }
    canvas.addEventListener('webglcontextlost', onLost)

    return () => {
      disposed = true
      if (frame) cancelAnimationFrame(frame)
      ro.disconnect()
      mo.disconnect()
      document.removeEventListener('visibilitychange', onVisible)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('webglcontextlost', onLost)
      gl.deleteTexture(tex)
      gl.deleteBuffer(buf)
      gl.deleteProgram(prog)
      // Give the context back now rather than whenever the browser collects
      // it — the map's own WebGL is the one that should be alone (iOS
      // Telegram reloads the page when there are two).
      gl.getExtension('WEBGL_lose_context')?.loseContext()
      canvas.remove()
    }
  }, [src, preview, heading, spin])

  return (
    <div className={`pano${className ? ` ${className}` : ''}`}>
      {state === 'fallback' ? (
        // No WebGL: the flat picture, scrolled sideways.
        <div className="pano-fallback">
          {/* eslint-disable-next-line @next/next/no-img-element -- a plain equirectangular strip */}
          <img src={preview ?? src} alt="" />
        </div>
      ) : (
        <div ref={boxRef} className="pano-box" role="img" aria-label="Панорама 360°, крути пальцем" />
      )}
      {state === 'loading' && <div className="pano-loading" aria-hidden />}
      {state === 'ready' && !touched && (
        <div className="pano-hint" aria-hidden>
          {/* A finger dragging sideways — what turns the view. */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 5h14M7.5 2.5 5 5l2.5 2.5M16.5 2.5 19 5l-2.5 2.5" />
            <path d="M10 21.5v-2.4l-2.6-2.9a1.45 1.45 0 0 1 2.05-2.05L11 15.7V10.8a1.3 1.3 0 0 1 2.6 0v3.6l3.3.7a2 2 0 0 1 1.6 2.3l-.7 4.1" />
          </svg>
          Крути пальцем · 360°
        </div>
      )}
    </div>
  )
}
