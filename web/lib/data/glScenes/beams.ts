// «Beams» (25.11.2026): sheaves of light beams running along fixed paths, with a bright head and a fading tail. Ported
// from the free «Beams» of shadcn.io (https://www.shadcn.io/background/beams) — see BackgroundGL.tsx for where it comes from
// and under which licence; its helpers are ours. The presets are the ones listed on its page; the theme colours are silver.
export const BEAMS_SCENE = `
uniform vec3 uColors[8];
uniform int uColorsCount;
uniform float uAngle;
uniform float uCount;
uniform float uCurve;
uniform float uFan;
uniform float uFrequency;
uniform float uGlow;
uniform float uIntensity;
uniform float uLength;
uniform float uSeed;
uniform float uSpread;
uniform float uTracks;
uniform float uWidth;
// The sheaf at s (-1 to 1 along the way): where its middle runs, and its half width.
vec2 pathAt(float s, float layer) {
  float bend = uCurve * (0.26 * sin(s * 1.5 + 0.5 + layer * 2.1) + 0.07 * sin(s * 3.4 - 1.2 + layer));
  float open = mix(1.0, 0.22 + 1.25 * smoothstep(-1.6, 1.4, s), uFan);
  float wide = 0.85 * uSpread * open * (1.0 + 0.28 * uCurve * sin(s * 2.2 - 0.8 + layer * 1.7));
  return vec2(bend, max(wide, 0.01));
}
// One sheaf: rgb is the beams' light (premultiplied by its amount, in a), and the fixed paths in track.
vec4 sheaf(vec2 st, vec2 extent, float layer, float count, float blur, out float track) {
  vec2 here = pathAt(st.x, layer);
  // Which path this pixel is on, 0 to count across the sheaf, and how fast that changes a pixel.
  float lane = ((st.y - here.x) / here.y * 0.5 + 0.5) * count;
  float slope = max(length(vec2(dFdx(lane), dFdy(lane))), 1e-5);
  float thick = 0.5 * uWidth * uPixelRatio * blur;
  float soft = 0.5 + (blur - 1.0) * uPixelRatio;
  float reach = 2.0 * max(uLength, 0.02);
  float share = clamp(0.5 * uFrequency, 0.0, 1.0);
  vec4 sum = vec4(0);
  track = 0.0;
  for (int i = -2; i <= 2; i++) {
    float id = floor(lane) + float(i);
    if (id < 0.0 || id >= count) continue;
    vec3 r = hash32(vec2(id + 0.5, uSeed * 7.3 + layer * 31.7 + 1.0));
    float at = id + 0.5 + (r.x - 0.5) * 0.55;
    float away = abs(lane - at);
    // A path shows two lanes around, and the sheaf thins out toward its two sides.
    float nearLane = smoothstep(2.5, 1.5, away) * smoothstep(0.0, 0.16, min(at, count - at) / count);
    float d = away / slope;
    float line = smoothstep(thick + soft, thick - soft, d);
    track += line * nearLane * (0.4 + 0.6 * r.y);
    // The beam: its head runs from before the box to past it, then the path rests or runs again.
    float turn = uTime * mix(0.05, 0.11, r.z) + r.y * 41.0;
    float lit = step(hash21(vec2(id + layer * 13.0, floor(turn) + uSeed * 3.1)), share) * nearLane;
    float head = mix(-1.2, 1.2 + reach, fract(turn));
    float back = (head - st.x) / reach;
    // The tail starts over the beam's own thickness, so its tip is round, and fades to its end.
    float tail = smoothstep(0.0, 2.0 * (thick + soft) / (extent.x * reach), back) * pow(clamp(1.0 - back, 0.0, 1.0), 1.4);
    float halo = exp(-d / (2.5 * thick + 2.0 * uPixelRatio)) * 0.28 * uGlow;
    float body = (line + halo) * tail * lit;
    // The head: a brighter bead no wider than the beam, and a soft glow around it.
    vec2 end = pathAt(head, layer);
    vec2 to = vec2(st.x - head, st.y - end.x - ((at / count) * 2.0 - 1.0) * end.y) * extent;
    float farDist = length(to) / (uPixelRatio * blur);
    float bead = (exp(-farDist * farDist / pow(0.8 * uWidth + 0.5, 2.0)) + exp(-farDist / (3.0 * uWidth + 5.0)) * mix(0.16, 0.3, uDark) * uGlow) / blur * lit;
    if (body + bead < 0.002) continue;
    vec3 color = ramp(uColors, uColorsCount, pow(clamp(back, 0.0, 1.0), 0.65) + (r.x - 0.5) * 0.2);
    sum += vec4(color * body + uColors[0] * bead, body + bead);
  }
  return sum;
}
vec4 scene(vec2 frag) {
  vec2 p = frag - 0.5 * uResolution;
  vec2 dir = vec2(cos(uAngle), sin(uAngle));
  // Half the box's span along the way and across it, so the sheaf fills any shape.
  vec2 extent = 0.5 * vec2(abs(dir.x) * uResolution.x + abs(dir.y) * uResolution.y, abs(dir.y) * uResolution.x + abs(dir.x) * uResolution.y);
  vec2 st = vec2(dot(p, dir), dot(p, vec2(-dir.y, dir.x))) / extent;
  float trackFront, trackBack;
  vec4 front = sheaf(st, extent, 0.0, uCount, 1.0, trackFront);
  // A second, softer sheaf behind: fewer paths, out of focus.
  vec4 back = sheaf(st * vec2(1.0, 0.9) + vec2(0.0, 0.12), extent, 1.0, floor(uCount * 0.5), 2.5, trackBack);
  vec4 light = front + back * 0.45;
  vec3 color = light.a > 0.0 ? light.rgb / light.a : vec3(0);
  // On a light surface the light becomes ink: the same hues, deeper, and pale ones most.
  vec3 lab = toOklab(color);
  float pale = smoothstep(0.7, 0.95, lab.x);
  float rich = 1.1 + 0.9 * pale * smoothstep(0.12, 0.03, length(lab.yz));
  color = mix(fromOklab(lab * vec3(mix(0.8, 0.62, pale), rich, rich)), color, uDark);
  // The paths draw themselves along the way as they first show, and catch the pointer's light.
  float reveal = smoothstep(0.0, 0.3, uIntro * 1.3 - (st.x * 0.5 + 0.5));
  vec2 away = (frag - uPointer.xy) / (220.0 * uPixelRatio);
  float lamp = 1.0 + 2.5 * exp(-dot(away, away)) * uPointer.z;
  vec3 ink = mixColor(vec3(1.0 - uDark), ramp(uColors, uColorsCount, 0.5), mix(0.5, 0.7, uDark));
  float lines = (trackFront + trackBack * 0.3) * uTracks * reveal * lamp * mix(0.42, 0.6, uDark);
  return over(glow(color, light.a * uIntensity * uIntro * mix(1.0, 1.3, uDark)), paint(ink, lines));
}
`

export type BeamsProps = {
  angle?: number
  colors?: string[]
  count?: number
  curve?: number
  fan?: number
  frequency?: number
  glow?: number
  intensity?: number
  length?: number
  seed?: number
  spread?: number
  tracks?: number
  width?: number
}

export function beamsUniforms(p: BeamsProps) {
  const d = { angle: 28, colors: ['#67e8f9', '#6d5cff', '#d946ef'], count: 30, curve: 1, fan: 0.7, frequency: 1, glow: 1, intensity: 1, length: 0.4, seed: 0, spread: 0.9, tracks: 0.6, width: 1.25, ...p }
  return {
    numbers: {
      uAngle: (d.angle * Math.PI) / 180,
      uCount: d.count,
      uCurve: d.curve,
      uFan: d.fan,
      uFrequency: d.frequency,
      uGlow: d.glow,
      uIntensity: d.intensity,
      uLength: d.length,
      uSeed: d.seed,
      uSpread: d.spread,
      uTracks: d.tracks,
      uWidth: d.width,
    },
    palettes: { uColors: d.colors },
    still: 9,
  }
}

export const BEAMS_PRESETS: { id: string; ru: string; en: string; props: BeamsProps }[] = [
  { id: 'sheaf', ru: 'Сноп', en: 'Sheaf', props: {} },
  { id: 'comets', ru: 'Кометы', en: 'Comets', props: { count: 8, frequency: 1.4, glow: 2, length: 0.7, tracks: 0.3, width: 3 } },
  { id: 'fiber', ru: 'Оптоволокно', en: 'Fiber', props: { colors: ['#a7f3d0', '#34d399', '#0ea5e9'], count: 48, curve: 0.6, frequency: 1.5, length: 0.22, width: 0.75 } },
  { id: 'fountain', ru: 'Фонтан', en: 'Fountain', props: { angle: 90, colors: ['#fdba74', '#f97316', '#e11d48'], curve: 0.3, fan: 1 } },
  { id: 'laser', ru: 'Лазер', en: 'Laser', props: { angle: 0, colors: ['#fda4af', '#f43f5e', '#7c3aed'], count: 16, curve: 0, fan: 1, length: 0.6, width: 1.5 } },
  { id: 'mono', ru: 'Серебро', en: 'Mono', props: { colors: ['#f5f5f5', '#8a8f98'], glow: 0.3, tracks: 0.9 } },
  { id: 'parallel', ru: 'Параллель', en: 'Parallel', props: { angle: -32, count: 40, curve: 0.4, fan: 0, spread: 0.6 } },
]
