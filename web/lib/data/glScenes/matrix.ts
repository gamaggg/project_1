// «Matrix» (25.11.2026): columns of falling glyphs with a bright head and a fading tail, in layers of depth. Ported from
// the free «Matrix» of shadcn.io (https://www.shadcn.io/background/matrix) — see BackgroundGL.tsx for where it comes from
// and under which licence; its helpers are ours (the glyph atlas is drawn from the preset's character set). The presets are
// the ones listed on its page; the theme colours of «Mono» are greys here.
export const MATRIX_SCENE = `
uniform vec3 uColor;
uniform vec3 uHeadColor;
uniform float uClearing;
uniform float uDensity;
uniform float uDepth;
uniform float uGlow;
uniform float uIntensity;
uniform float uShuffle;
uniform float uSize;
uniform float uTrail;
// The inks in OKLab: the tail's end (a deeper, cooler shade), the tail, the head.
vec3 deepLab, bodyLab, headLab;
// A color as this surface shows it: as is on a dark one, a darker ink on a light one.
vec3 inkOf(vec3 color, float cap) {
  vec3 lab = toOklab(color);
  lab.x = mix(min(lab.x, cap), lab.x, uDark);
  return lab;
}
// One column at a row: x how lit its tail is, y how close the head is, z which run it is.
vec3 stream(float column, float row, float layer) {
  vec2 k = hash22(vec2(column, layer * 31.0 + 5.0));
  float period = 10.0 + 22.0 * k.y + 24.0 * uTrail;
  float behind = uTime * mix(2.6, 6.2, k.x) / (1.0 + layer * 0.5) + k.y * 97.0 - row;
  float run = floor(behind / period);
  float d = behind - run * period;
  vec2 own = hash22(vec2(column + layer * 131.0, run));
  float len = uTrail * mix(10.0, 24.0, own.y);
  float tail = clamp(1.0 - d / len, 0.0, 1.0) * smoothstep(0.0, 0.3, d) * step(own.x, uDensity);
  return vec3(tail, 1.0 - smoothstep(0.5, 2.5, d), run);
}
// One layer of rain: p in device pixels from the top, in cells of "cell" pixels.
// "heat" is how hot the heads run; "cover" comes back as how lit this spot of the layer is.
vec4 rain(vec2 p, float cell, float layer, float soften, float lit, float heat, out float cover) {
  vec2 g = p / cell;
  vec2 id = floor(g);
  vec3 s = stream(id.x, id.y, layer);
  // The glyph of this cell: one per run, and some swap now and then.
  vec2 k = hash22(id + layer * 57.0);
  float swaps = floor(uTime * mix(0.5, 2.2, k.y) + k.y * 53.0) * step(k.x, uShuffle);
  float index = min(floor(hash21(id + vec2(s.z * 7.3 + layer, swaps * 3.1)) * uAtlasCount), uAtlasCount - 1.0);
  vec2 q = (g - id - 0.5) / 1.1 + 0.5;
  float du = soften / (cell * 1.1);
  float inside = step(abs(q.x - 0.5), 0.5) * step(abs(q.y - 0.5), 0.5);
  float glyph = textureGrad(uAtlas, vec2((index + clamp(q.x, 0.0, 1.0)) / uAtlasCount, 1.0 - q.y), vec2(du / uAtlasCount, 0.0), vec2(0.0, du)).a * inside;
  // The soft light of this column and its neighbours, continuous down the tail.
  float light = 0.0;
  for (int i = -1; i <= 1; i++) {
    float column = id.x + float(i);
    vec3 n = stream(column, g.y - 0.5, layer);
    float dx = g.x - column - 0.5;
    light += exp(-dx * dx * 3.2) * n.x * (0.3 + 0.7 * n.y * heat);
  }
  cover = min(light * 1.6, 1.0);
  float head = s.y * heat;
  // Now and then a glyph in the tail flares for a moment.
  float flare = pow(max(sin(uTime * (0.6 + k.x) + k.y * TAU), 0.0), 30.0) * heat;
  vec3 color = fromOklab(mix(mix(deepLab, bodyLab, min(s.x * 1.4 + flare, 1.0)), headLab, head));
  // Light on a dark surface reads dimmer than ink on a light one: lift the tail there.
  float lift = pow(s.x * mix(0.55, 1.0, k.x), mix(1.0, 0.6, uDark));
  // Where the heads are cooled, no glyph outshines the rain's own color either.
  float amount = glyph * min(lift * (1.0 + 0.4 * head + 0.5 * flare) + lit * 0.3, 1.0 + 0.5 * heat);
  return over(glow(color, amount * uIntensity * mix(1.15, 1.0, uDark)), glow(fromOklab(deepLab), light * uGlow * mix(0.24, 0.36, uDark) * uIntensity));
}
vec4 scene(vec2 frag) {
  vec2 p = vec2(frag.x - floor(0.5 * uResolution.x), uResolution.y - frag.y);
  float cell = max(floor(uSize * uPixelRatio + 0.5), 4.0);
  bodyLab = inkOf(uColor, 0.5);
  headLab = inkOf(uHeadColor, 0.25);
  deepLab = vec3(bodyLab.x * 0.86, rotate(-0.5) * bodyLab.yz);
  // The pointer shows the glyphs around it; a press sends a ring through them.
  float reach = distance(frag, uPointer.xy) / uPixelRatio;
  float lit = uPointer.z * exp(-reach * reach / 14000.0);
  for (int i = 0; i < 4; i++) {
    vec4 pulse = uPulses[i];
    float ring = (distance(frag, pulse.xy) / uPixelRatio - pulse.z * 260.0) / 40.0;
    lit += exp(-ring * ring) * exp(-pulse.z * 2.0) * pulse.w * 1.5;
  }
  // The clearing: the middle band, where copy sits, rains dimmer and without bright heads.
  vec2 band = pow(abs(uvOf(frag) - 0.5) / vec2(0.6, 0.42), vec2(4.0));
  float calm = uClearing * (1.0 - smoothstep(0.55, 1.2, pow(band.x + band.y, 0.25)));
  float heat = clamp(1.0 - 2.0 * calm, 0.0, 1.0);
  // Front to back: each layer is smaller, softer and slower, and shows between the one before.
  float cover;
  vec4 sum = rain(p, cell, 0.0, 0.85, lit, heat, cover);
  float open = 1.0 - 0.85 * cover;
  for (int i = 1; i < 3; i++) {
    float layer = float(i);
    float shrink = i == 1 ? 0.72 : 0.47;
    float small = max(floor(cell * shrink + 0.5), 3.0);
    vec4 back = rain(p + cell * 0.37 * layer, small, layer, 0.9 + 0.6 * layer, lit * 0.5, heat, cover);
    // A layer whose glyphs would be too few pixels to be glyphs fades out.
    float legible = smoothstep(5.0, 9.0, small);
    sum = over(sum, back * uDepth * open * legible * (i == 1 ? 0.7 : 0.4));
    open *= 1.0 - 0.7 * cover;
  }
  // The rain comes down from the top as it first shows.
  float reveal = smoothstep(0.0, 1.0, uIntro * 1.4 - 0.4 * p.y / uResolution.y);
  return sum * reveal * (1.0 - 0.9 * calm);
}
`

const GLYPHS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789'

export type MatrixProps = {
  clearing?: number
  color?: string
  density?: number
  depth?: number
  glow?: number
  glyphs?: string
  headColor?: string
  intensity?: number
  shuffle?: number
  size?: number
  speed?: number
  trail?: number
}

export function matrixUniforms(p: MatrixProps) {
  const d = { clearing: 0.5, color: '#2fe38a', density: 0.75, depth: 0.6, glow: 0.5, glyphs: GLYPHS, headColor: '#e6fff0', intensity: 1, shuffle: 0.35, size: 16, speed: 1, trail: 1, ...p }
  return {
    numbers: {
      uClearing: d.clearing,
      uDensity: d.density,
      uDepth: d.depth,
      uGlow: d.glow,
      uIntensity: d.intensity,
      uShuffle: d.shuffle,
      uSize: d.size,
      uTrail: d.trail,
    },
    colors: { uColor: d.color, uHeadColor: d.headColor },
    atlas: d.glyphs || GLYPHS,
    speed: d.speed,
    still: 8,
  }
}

export const MATRIX_PRESETS: { id: string; ru: string; en: string; props: MatrixProps }[] = [
  { id: 'rain', ru: 'Дождь', en: 'Rain', props: {} },
  { id: 'amber', ru: 'Янтарь', en: 'Amber', props: { color: '#ffb224', density: 0.6, glow: 0.8, glyphs: '0123456789ABCDEF', headColor: '#fff4d6', size: 20, speed: 0.7, trail: 1.5 } },
  { id: 'binary', ru: 'Двоичный', en: 'Binary', props: { color: '#5cc8ff', glow: 0.8, glyphs: '01', headColor: '#f0f9ff', shuffle: 0.8, size: 14, trail: 0.7 } },
  { id: 'cipher', ru: 'Шифр', en: 'Cipher', props: { color: '#c084fc', density: 0.9, depth: 0.8, glyphs: '<>/{}[]()=+-*#$%&!?;:', headColor: '#fdf4ff', intensity: 1.3, shuffle: 1, size: 15, trail: 0.6 } },
  { id: 'classic', ru: 'Классика', en: 'Classic', props: { clearing: 0, color: '#00ff41', density: 1, depth: 0.3, glow: 1, glyphs: 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789', headColor: '#ffffff', size: 14, trail: 1.4 } },
  { id: 'drizzle', ru: 'Морось', en: 'Drizzle', props: { clearing: 0.3, density: 0.3, depth: 1, size: 22, speed: 0.6, trail: 1.8 } },
  { id: 'mono', ru: 'Серебро', en: 'Mono', props: { color: '#8a8f98', depth: 0.4, glow: 0, headColor: '#f5f5f5' } },
]
