// «Fog» (25.11.2026): layered banks of mist sliding sideways, a low light glowing inside them. Ported from the free «Fog»
// of shadcn.io (https://www.shadcn.io/background/fog) — see BackgroundGL.tsx for where it comes from and under which
// licence; its helpers are ours. The presets are the ones listed on its page; the theme colours of «Mono» are greys here.
// The profile background is a dark surface, so the scene's night palette and light are the ones that show.
export const FOG_SCENE = `
uniform vec3 uDay[8];
uniform int uDayCount;
uniform vec3 uNight[8];
uniform int uNightCount;
uniform vec3 uDayLight;
uniform vec3 uNightLight;
uniform float uDensity;
uniform float uDetail;
uniform float uDrift;
uniform float uHeight;
uniform float uHoles;
uniform float uLayers;
uniform float uLight;
uniform float uPlacement;
uniform float uScale;
// The palette far to near. Its neighbours are close in hue, so a plain mix
// is as clean as an OKLab one and far cheaper for every layer of every pixel.
vec3 tone(float t) {
  bool night = uDark > 0.5;
  int count = night ? uNightCount : uDayCount;
  float x = clamp(t, 0.0, 1.0) * float(max(count - 1, 1));
  int i = int(min(floor(x), float(max(count - 2, 0))));
  int j = min(i + 1, count - 1);
  return night ? mix(uNight[i], uNight[j], x - float(i)) : mix(uDay[i], uDay[j], x - float(i));
}
// One layer of mist at depth k (0 far, 1 near): wide flat banks that slide
// sideways, thick where bank is 1 and thinning to wisps as it falls to 0.
// x is how much mist, y how much of the light its top catches.
vec2 mist(vec2 p, float k, float bank, float up) {
  float s = uScale * mix(1.5, 0.8, k);
  // Mist lies flat: the noise is stretched sideways and never turned, so
  // every bank and wisp stays level.
  vec2 q = vec2(p.x * 0.5, p.y * 1.5) * s + vec2(k * 23.7, k * 7.3);
  q.x -= uTime * uDrift * mix(0.006, 0.017, k) * s;
  // The banks billow slowly as they slide: a broad, cheap warp.
  float t = uTime * 0.02;
  vec2 w = vec2(vnoise(q * 0.7 + vec2(k * 5.0, t)), vnoise(q * 0.7 + vec2(9.0 - t, k * 3.0))) - 0.5;
  vec2 r = q + w * vec2(0.5, 0.26);
  float bulk = snoise(r);
  // The same bank a little toward the light: thinner there means a lit top.
  float top = clamp(0.5 + (bulk - snoise(r + vec2(0.03, 0.22 * up))) * 1.3, 0.0, 1.0);
  // Smaller billows, then thin wisps: detail sets how much of those shows.
  float n = bulk * 0.6 + snoise(r * vec2(1.9, 2.3) + 13.7) * 0.28 + snoise(r * vec2(3.7, 5.9) + 31.1) * mix(0.05, 0.32, uDetail);
  // Far layers stay whole, near ones open into soft holes.
  float holes = uHoles * mix(0.35, 1.0, k);
  // A light surface shows less of a soft edge, so the mist is cut a little crisper there.
  float amount = smoothstep(-0.05, mix(0.38, 0.5, uDark), n * 0.85 + mix(-1.25, 0.95 - holes * 0.9, bank));
  return vec2(amount * smoothstep(0.0, 0.55, bank), top);
}
vec4 scene(vec2 frag) {
  vec2 uv = uvOf(frag);
  float aspect = uResolution.x / uResolution.y;
  // The banks are sized by the box's height, but never smaller than a hero's.
  vec2 p = vec2(frag.x - 0.5 * uResolution.x, frag.y) / max(uResolution.y, 440.0 * uPixelRatio);
  bool full = uPlacement > 1.5;
  float up = uPlacement > 0.5 && !full ? -1.0 : 1.0;
  // How far this pixel is from the edge the mist lies along.
  float e = up < 0.0 ? 1.0 - uv.y : uv.y;
  // The mist rises a little as it first shows.
  float height = max(uHeight, 0.05) * (0.7 + 0.3 * uIntro) * mix(1.15, 1.0, uDark);
  vec3 lightColor = uDark > 0.5 ? uNightLight : uDayLight;
  // A plain haze under everything, so a gap shows mist and not the surface.
  float haze = full ? 0.8 : 1.0 - smoothstep(0.0, height * 1.15, e);
  vec4 sum = paint(tone(0.3), (1.0 - exp(-pow(haze, 1.5) * uDensity * mix(1.0, 1.3, uDark))) * uIntro);
  // The light: a low sun or moon inside the mist, which glows around it. It
  // sits near the edge, so the middle of the box stays calm.
  vec2 lp = vec2((uv.x - 0.68) * aspect * 0.7, (e - (full ? 0.2 : height * 0.26)) * 1.5);
  float lit = (exp(-dot(lp, lp) * mix(16.0, 10.0, uDark)) * 0.6 + exp(-dot(lp, lp) * 50.0) * 0.4) * uLight * haze * mix(1.0, 1.3, uDark);
  sum = over(paint(lightColor, lit * 0.8 * uIntro), sum);
  // The pointer clears a soft patch.
  float away = length(frag - uPointer.xy) / uPixelRatio;
  float clearing = uPointer.z * exp(-away * away / 26000.0);
  float count = clamp(floor(uLayers + 0.5), 2.0, 6.0);
  for (int i = 0; i < 6; i++) {
    if (float(i) >= count) break;
    float k = float(i) / (count - 1.0);
    // Far layers reach higher up the box, near ones hug the edge.
    float bank = full ? 0.62 : clamp(1.0 - e / (height * mix(1.3, 0.6, k)), 0.0, 1.0);
    // Past its reach a layer costs nothing.
    if (bank <= 0.0) continue;
    vec2 m = mist(p, k, bank, up);
    float amount = m.x * (1.0 - clearing * mix(0.6, 0.95, k)) * (full ? 0.8 : 1.0);
    // Tops catch the light, undersides sit in the layer's own shade, and the
    // mist around the light glows with it.
    float warm = m.y * mix(0.2, 0.45, uDark) * uLight + lit * mix(0.9, 0.6, k);
    vec3 color = mixColor(tone(k) * mix(mix(0.74, 0.8, uDark), 1.0, m.y), lightColor, min(warm, 1.0));
    // Density is optical depth: more of it thickens the mist, never to a slab.
    sum = over(paint(color, (1.0 - exp(-amount * uDensity * mix(0.75, 1.1, k) * mix(1.25, 1.0, uDark))) * uIntro), sum);
  }
  return sum;
}
`

const DAY = ['#bfcce0', '#8ea4c2', '#5f789f']
const NIGHT = ['#2a2f4a', '#3a4868', '#5b7096']
const PLACEMENTS = { bottom: 0, full: 2, top: 1 } as const

export type FogProps = {
  colors?: string[]
  density?: number
  detail?: number
  drift?: number
  height?: number
  holes?: number
  layers?: number
  light?: number
  lightColor?: string
  placement?: keyof typeof PLACEMENTS
  scale?: number
}

export function fogUniforms(p: FogProps) {
  const d = { density: 1, detail: 0.5, drift: 1, height: 0.62, holes: 0.5, layers: 4, light: 0.6, placement: 'bottom' as const, scale: 1, ...p }
  return {
    numbers: {
      uDensity: d.density,
      uDetail: d.detail,
      uDrift: d.drift,
      uHeight: d.height,
      uHoles: d.holes,
      uLayers: d.layers,
      uLight: d.light,
      uPlacement: PLACEMENTS[d.placement],
      uScale: d.scale,
    },
    colors: { uDayLight: d.lightColor ?? '#ffc4a8', uNightLight: d.lightColor ?? '#cfe0ff' },
    palettes: { uDay: d.colors ?? DAY, uNight: d.colors ?? NIGHT },
    still: 24,
  }
}

export const FOG_PRESETS: { id: string; ru: string; en: string; props: FogProps }[] = [
  { id: 'morning', ru: 'Утро', en: 'Morning', props: {} },
  { id: 'ceiling', ru: 'Потолок', en: 'Ceiling', props: { detail: 0.8, height: 0.5, placement: 'top' } },
  { id: 'dusk', ru: 'Сумерки', en: 'Dusk', props: { colors: ['#f3c9b5', '#c69ab8', '#7b6aa3'], light: 1, lightColor: '#ffb27a' } },
  { id: 'mono', ru: 'Серебро', en: 'Mono', props: { colors: ['#3a3d45', '#8a8f98'], density: 0.8, holes: 0.7, light: 0 } },
  { id: 'orchid', ru: 'Орхидея', en: 'Orchid', props: { colors: ['#d8ccff', '#b49cf5', '#8463e0'], light: 0.9, lightColor: '#ffb3d1' } },
  { id: 'valley', ru: 'Долина', en: 'Valley', props: { density: 1.4, height: 0.4, holes: 0.15, layers: 5, light: 0.7 } },
  { id: 'veil', ru: 'Вуаль', en: 'Veil', props: { density: 0.7, holes: 0.8, layers: 3, light: 0.3, placement: 'full', scale: 0.7 } },
]
