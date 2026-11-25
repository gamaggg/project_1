// «Gradient» (25.11.2026): bands of a palette bending and drifting like a soft flow, optional film grain. Ported from the
// free «Gradient» of shadcn.io (https://www.shadcn.io/background/gradient) — see BackgroundGL.tsx for where it comes from
// and under which licence; its helpers are ours. The presets are the ones listed on its page; the theme colours of
// «Halo» and «Mono» are the dark surface and silver here.
export const GRADIENT_SCENE = `
uniform vec3 uColors[8];
uniform int uColorsCount;
uniform float uAngle;
uniform float uContrast;
uniform float uDetail;
uniform float uFlow;
uniform float uIntensity;
uniform vec2 uOrigin;
uniform float uScale;
uniform float uSeed;
uniform float uSoftness;
uniform float uType;
uniform float uWarp;
// One palette color in OKLab, held to a tone copy reads on: lifted on a light
// surface, lowered on a dark one, where a warm color turns to ember red, never
// brown. Past intensity 1 the hold lets go.
vec3 tone(vec3 color) {
  vec3 lab = toOklab(color);
  float push = clamp(uIntensity - 1.0, 0.0, 1.0);
  float lo = mix(0.64, 0.0, push), hi = mix(0.545, 1.0, push);
  float lifted = 0.5 * (lab.x + lo + sqrt((lab.x - lo) * (lab.x - lo) + 0.004));
  float deep = lab.x * mix(0.86, 1.0, push);
  float lowered = 0.5 * (deep + hi - sqrt((deep - hi) * (deep - hi) + 0.004));
  float hue = atan(lab.z, lab.y + 1e-6);
  float warm = smoothstep(0.4, 0.85, hue) * (1.0 - smoothstep(1.8, 2.3, hue));
  float drop = max(lab.x - lowered, 0.0) * warm * uDark;
  float chroma = max(length(lab.yz), 1e-4);
  lab.yz = rotate(min(drop * 2.8, max(hue - 0.35, 0.0))) * lab.yz * clamp(0.2 / chroma, 1.0, 1.0 + drop * 2.4);
  lab.x = mix(lifted, lowered, uDark);
  return lab;
}
// The palette there and back, so only neighbors in the list ever blend.
// edge is one device pixel in runs of the palette: a flat band stays antialiased.
vec3 band(float t, float edge) {
  int last = max(uColorsCount - 1, 1);
  float x = (1.0 - abs(fract(t * 0.5) * 2.0 - 1.0)) * float(last);
  int i = int(min(floor(x), float(last - 1)));
  float soft = clamp(max(uSoftness, edge * float(last)) * 0.5, 0.0, 0.5);
  return mix(tone(uColors[i]), tone(uColors[min(i + 1, uColorsCount - 1)]), smoothstep(0.5 - soft, 0.5 + soft, x - float(i)));
}
vec4 scene(vec2 frag) {
  float side = min(uResolution.x, uResolution.y);
  // The box with its shorter side spanning 1, so the bends never stretch.
  vec2 box = uResolution / side;
  vec2 p = fitted(frag);
  float time = uTime * 0.04;
  // The run: across the box along the angle, out from the origin, or around it.
  vec2 dir = vec2(sin(uAngle), cos(uAngle));
  vec2 from = p - uOrigin * 0.5 * box;
  float r = max(length(from), 1e-4);
  float run, slope;
  if (uType < 0.5) {
    slope = uScale / (abs(dir.x) * box.x + abs(dir.y) * box.y);
    run = dot(p, dir) * slope + 0.5;
  } else if (uType < 1.5) {
    slope = uScale / length((0.5 + 0.5 * abs(uOrigin)) * box);
    run = r * slope;
  } else {
    float turns = 2.0 * max(floor(uScale + 0.5), 1.0);
    slope = turns / (TAU * max(r, 0.3));
    run = (atan(from.x, from.y) - uAngle) / TAU * turns;
  }
  // The bend, in short sides: two slow layers of noise, the finer one carried
  // by the broader. A stronger warp is also a broader one, so bands never break up.
  vec2 q = p + uSeed * 5.3;
  float broad = snoise(q * 0.6 / max(uWarp, 1.0) + vec2(time, -time * 0.6));
  float fine = snoise(rotate(1.1) * q * 1.5 + vec2(-time * 0.9, time * 1.2) + broad * 0.4);
  // The bands bow toward the pointer.
  vec2 away = p - (uPointer.xy - 0.5 * uResolution) / side;
  float bend = (broad * 0.24 * uWarp + fine * 0.07 * uDetail * min(uWarp, 1.0) + uPointer.z * 0.14 * exp(-dot(away, away) * 7.0)) * slope;
  // The bands slide into place as it first shows, then travel along the run.
  float t = run + bend - uTime * 0.02 * uFlow + (1.0 - uIntro) * 0.3;
  float edge = slope / side + length(vec2(dFdx(bend), dFdy(bend)));
  vec3 lab = band(t, edge * 1.5);
  // Light travels with the bands, two crests to a run of the palette: a crest
  // thins toward a light surface, the trough between two sinks into a dark one.
  float glowAmount = snoise(q * 0.35 + vec2(4.0 - time * 0.5, time * 0.3));
  float lit = smoothstep(0.0, 1.0, 0.5 + 0.2 * uDark - 0.5 * cos(2.0 * TAU * t + 1.6 * glowAmount));
  float shade = (1.0 - lit) * uDark * uContrast / (0.6 + 0.4 * uContrast);
  lab.x *= 1.0 - 0.2 * shade;
  float thin = mix(lit * 0.25 * uContrast, shade * 0.6, uDark);
  float amount = min(uIntensity, 1.0) * clamp(1.0 - thin, 0.0, 1.0);
  return paint(fromOklab(lab), amount);
}
`

const ORIGINS = { bottom: [0, -1], center: [0, 0], left: [-1, 0], right: [1, 0], top: [0, 1] } as const
const TYPES = { conic: 2, linear: 0, radial: 1 } as const

export type GradientProps = {
  angle?: number
  colors?: string[]
  contrast?: number
  detail?: number
  flow?: number
  grain?: number
  intensity?: number
  origin?: keyof typeof ORIGINS
  scale?: number
  seed?: number
  softness?: number
  type?: keyof typeof TYPES
  warp?: number
}

export function gradientUniforms(p: GradientProps) {
  const d = { angle: 135, colors: ['#fb923c', '#f472b6', '#6366f1', '#38bdf8'], contrast: 1, detail: 0.5, flow: 1, grain: 0, intensity: 1, origin: 'center' as const, scale: 1, seed: 0, softness: 1, type: 'linear' as const, warp: 1, ...p }
  return {
    numbers: {
      uAngle: (d.angle * Math.PI) / 180,
      uContrast: d.contrast,
      uDetail: d.detail,
      uFlow: d.flow,
      uIntensity: d.intensity,
      uScale: d.scale,
      uSeed: d.seed,
      uSoftness: d.softness,
      uType: TYPES[d.type],
      uWarp: d.warp,
    },
    vec2s: { uOrigin: [ORIGINS[d.origin][0], ORIGINS[d.origin][1]] as [number, number] },
    palettes: { uColors: d.colors },
    grain: d.grain,
    still: 6,
  }
}

const SURFACE = '#05070d'
export const GRADIENT_PRESETS: { id: string; ru: string; en: string; props: GradientProps }[] = [
  { id: 'stream', ru: 'Поток', en: 'Stream', props: {} },
  { id: 'fan', ru: 'Веер', en: 'Fan', props: { colors: ['#22d3ee', '#6366f1', '#a855f7', '#ec4899'], origin: 'top', scale: 2, type: 'conic' } },
  { id: 'grainy', ru: 'Зерно', en: 'Grainy', props: { colors: ['#fb923c', '#f472b6', '#6366f1'], grain: 0.55, warp: 1.6 } },
  { id: 'halo', ru: 'Ореол', en: 'Halo', props: { colors: [SURFACE, '#818cf8', '#f472b6'], flow: 0, scale: 0.9, type: 'radial', warp: 1.2 } },
  { id: 'layers', ru: 'Слои', en: 'Layers', props: { scale: 2, softness: 0, warp: 1.4 } },
  { id: 'mono', ru: 'Серебро', en: 'Mono', props: { colors: ['#f5f5f5', '#8a8f98', SURFACE], contrast: 0.6 } },
  { id: 'ocean', ru: 'Океан', en: 'Ocean', props: { angle: 180, colors: ['#5eead4', '#38bdf8', '#6366f1', '#1e3a8a'], flow: 0.5, warp: 0.8 } },
  { id: 'sunrise', ru: 'Рассвет', en: 'Sunrise', props: { colors: ['#fde68a', '#fb923c', '#f43f5e', '#7c3aed'], flow: 0, origin: 'bottom', scale: 0.9, type: 'radial', warp: 0.6 } },
]
