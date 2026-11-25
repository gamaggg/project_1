// «Starfield» (25.11.2026): a night sky of stars in layers with haze, twinkling and a slow drift. Ported from the free
// «Starfield» of shadcn.io (https://www.shadcn.io/background/starfield) — see BackgroundGL.tsx for where it comes from and
// under which licence; its helpers are ours. The presets are the ones listed on its page.
export const STARFIELD_SCENE = `
uniform vec3 uColor;
uniform vec3 uHazeColors[8];
uniform int uHazeColorsCount;
uniform float uDensity;
uniform float uDepth;
uniform float uDirection;
uniform float uGlow;
uniform float uHaze;
uniform float uIntensity;
uniform float uSize;
uniform float uTwinkle;
uniform float uWarmth;
uniform float uWarp;
// The star colour in OKLab, kept off the surface: too close to it, its lightness flips.
vec3 legible(vec3 c) {
  vec3 lab = toOklab(c);
  float ground = toOklab(uSurface).x;
  lab.x = mix(lab.x, ground > 0.5 ? 0.2 : 0.97, smoothstep(0.22, 0.1, abs(lab.x - ground)));
  return lab;
}
// One layer of stars. p is in cells, z runs 0 (far) to 1 (near), px is a cell in device pixels.
// A star reaches at most half a cell, so the four nearest cells are all that can touch a pixel.
vec4 stars(vec2 p, float z, float px, float seed, float crowd, mat2 turn, mat3 tones) {
  vec4 sum = vec4(0);
  vec2 base = floor(p - 0.5);
  for (int j = 0; j < 2; j++) {
    for (int i = 0; i < 2; i++) {
      vec2 cell = base + vec2(i, j);
      vec3 h = hash32(cell + seed);
      // A star shows within half a cell of itself: past that, it's skipped before the costly part.
      vec2 gap = p - cell - h.xy;
      if (dot(gap, gap) > 0.25) continue;
      // Back to the screen's axes, in device pixels.
      vec2 d = (gap * turn) * px;
      float dist = length(d);
      // Few bright, many dim.
      float mag = h.z * h.z * h.z;
      float r = uSize * uPixelRatio * mix(0.6, 1.1, z) * (0.7 + 1.5 * mag);
      // A star thinner than a device pixel keeps its light in a wider, dimmer dot.
      float rr = max(r, 0.85);
      // The brightest carry a halo and a thin cross of light.
      float bright = smoothstep(0.4, 1.0, mag) * uGlow;
      // Past its core, and its halo when it has one, nothing of it reaches this pixel.
      if (dist > rr * (bright > 0.0 ? 30.0 : 3.0)) continue;
      vec3 k = hash32(cell * 1.31 + seed + 17.3);
      if (k.z > 0.86) continue;
      float beat = sin(uTime * (0.5 + 1.9 * k.x) + k.y * TAU) * sin(uTime * (0.23 + 0.6 * k.y) + k.x * TAU);
      float b = (0.5 + 0.5 * mag) * (1.0 - uTwinkle * 0.8 * (0.5 + 0.5 * beat)) * (r / rr);
      float core = exp(-dist * dist / (rr * rr));
      float halo = mix(0.25, 0.45, uDark) * exp(-dist / (rr * 2.6));
      float arms = mix(0.3, 0.6, uDark) * exp(-min(abs(d.x), abs(d.y)) / (rr * 0.4) - dist / (rr * 5.0));
      float amount = (core + bright * (halo + arms)) * b * smoothstep(0.5, 0.32, dist / px) * smoothstep(crowd + 0.07, crowd - 0.07, k.z);
      // Most stars keep the base colour; some lean blue, some amber.
      float t = fract(k.z * 31.7) * 2.0 - 1.0;
      vec3 tone = mix(tones[0], t > 0.0 ? tones[2] : tones[1], smoothstep(0.2, 1.0, abs(t)) * uWarmth);
      sum += vec4(tone * amount, amount);
    }
  }
  return sum;
}
vec4 scene(vec2 frag) {
  // The sky settles outward as it first shows.
  vec2 p = centered(frag) * mix(1.05, 1.0, uIntro);
  vec2 lean = (uPointer.xy / uResolution - 0.5) * uPointer.z;
  vec2 way = vec2(cos(uDirection), sin(uDirection));
  float drift = uTime * (1.0 - 0.85 * uWarp);
  // The haze: slow clouds in two tones, thicker along a diagonal.
  vec2 hp = fitted(frag) - lean * 0.012 * uDepth - way * drift * 0.004;
  float cloud = fbm(hp * 1.3 + vec2(3.1, 1.7), 3) * 0.5 + 0.5;
  float lane = exp(-pow(dot(hp, vec2(-0.42, 0.91)) * 2.4, 2.0));
  float mist = smoothstep(0.4, 1.15, cloud + lane * 0.5);
  float turnHaze = smoothstep(0.25, 0.75, fbm(hp * 0.9 - vec2(7.3, 2.9), 2) * 0.5 + 0.5);
  vec4 haze = glow(ramp(uHazeColors, uHazeColorsCount, turnHaze), mist * uHaze * uIntensity * uIntro * mix(0.2, 0.3, uDark));
  // The three tones a star can take: the base, a cool one and a warm one.
  vec3 lab = legible(uColor);
  float tinted = mix(lab.x, mix(0.5, 0.86, uDark), 0.7);
  mat3 tones = mat3(fromOklab(lab), fromOklab(vec3(tinted, lab.yz + vec2(-0.03, -0.14))), fromOklab(vec3(tinted, lab.yz + vec2(0.06, 0.12))));
  vec4 sum = vec4(0);
  float spread = clamp(uDepth, 0.0, 1.0);
  float pack = inversesqrt(max(uDensity, 0.05));
  for (int l = 0; l < 5; l++) {
    float fl = float(l);
    // Flying through: each layer comes closer, fades out near and returns far.
    float rest = (fl + 0.5) / 5.0;
    float z = fract(rest + uTime * 0.02 * uWarp);
    float cell = 30.0 * pow(4.6, z) * pack;
    float home = 30.0 * pow(4.6, rest) * pack;
    // Near layers travel faster, and lean further with the pointer.
    float pace = 4.5 * mix(1.0 / home, 1.0 / (64.0 * pack), spread);
    mat2 spin = rotate(fl * 0.71 + 0.4);
    vec2 q = spin * ((p - lean * 26.0 * uDepth * (0.15 + z)) / cell - way * drift * pace) + fl * 13.7;
    float fade = smoothstep(0.0, 0.1, z) * smoothstep(1.0, 0.9, z);
    // More of the faint far stars where the haze is thick.
    float crowd = mix(mix(0.4, 0.9, mist), 0.72, z);
    sum += stars(q, z, cell * uPixelRatio, fl * 37.0, crowd, spin, tones) * fade * mix(0.7, 1.0, z);
  }
  vec3 color = sum.a > 0.0 ? sum.rgb / sum.a : vec3(0);
  vec4 sky = glow(color, sum.a * uIntensity * uIntro * mix(1.2, 1.0, uDark));
  return over(sky, haze);
}
`

export type StarfieldProps = {
  color?: string
  density?: number
  depth?: number
  direction?: number
  glow?: number
  haze?: number
  hazeColors?: string[]
  intensity?: number
  size?: number
  twinkle?: number
  warmth?: number
  warp?: number
}

export function starfieldUniforms(p: StarfieldProps) {
  const d = { color: '#f5f5f5', density: 1, depth: 0.7, direction: 160, glow: 0.5, haze: 0.5, hazeColors: ['#5a4dff', '#1f8fff'], intensity: 1, size: 1, twinkle: 0.5, warmth: 0.6, warp: 0, ...p }
  return {
    numbers: {
      uDensity: d.density,
      uDepth: d.depth,
      uDirection: (d.direction * Math.PI) / 180,
      uGlow: d.glow,
      uHaze: d.haze,
      uIntensity: d.intensity,
      uSize: d.size,
      uTwinkle: d.twinkle,
      uWarmth: d.warmth,
      uWarp: d.warp,
    },
    colors: { uColor: d.color },
    palettes: { uHazeColors: d.hazeColors },
    still: 8,
  }
}

export const STARFIELD_PRESETS: { id: string; ru: string; en: string; props: StarfieldProps }[] = [
  { id: 'night', ru: 'Ночь', en: 'Night', props: {} },
  { id: 'deep', ru: 'Глубина', en: 'Deep', props: { density: 2.4, depth: 1, glow: 0.25, haze: 0.8, hazeColors: ['#7a3dff', '#d43d9b', '#2f6bff'], size: 0.8, twinkle: 0.3 } },
  { id: 'dusk', ru: 'Сумерки', en: 'Dusk', props: { direction: 90, haze: 0.7, hazeColors: ['#d857ff', '#5a5cff'], warmth: 1 } },
  { id: 'dust', ru: 'Пыль', en: 'Dust', props: { density: 3, glow: 0, haze: 0.5, hazeColors: ['#19b8d8', '#2f6bff'], intensity: 1.4, size: 0.6, twinkle: 0.9 } },
  { id: 'giants', ru: 'Гиганты', en: 'Giants', props: { density: 0.4, glow: 0.8, haze: 0.2, size: 1.8, twinkle: 0.3 } },
  { id: 'mono', ru: 'Серебро', en: 'Mono', props: { density: 1.6, glow: 0, haze: 0, twinkle: 0.2, warmth: 0 } },
  { id: 'warp', ru: 'Прыжок', en: 'Warp', props: { density: 1.3, glow: 0.9, haze: 0.25, warp: 1 } },
]
