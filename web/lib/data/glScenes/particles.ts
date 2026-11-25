// «Particles» (25.11.2026): floating dots in layers with depth, a soft bloom, slow wandering paths. Ported from the free
// «Particles» of shadcn.io (https://www.shadcn.io/background/particles) — see BackgroundGL.tsx for where it comes from and
// under which licence; its helpers are ours. The presets are the ones listed on its page; the theme colours are silver here.
export const PARTICLES_SCENE = `
uniform vec3 uColor;
uniform vec3 uAccentColor;
uniform float uAccent;
uniform float uCount;
uniform float uDepth;
uniform float uDirection;
uniform float uDrift;
uniform float uIntensity;
uniform float uRepel;
uniform float uSize;
uniform float uSoftness;
uniform float uTwinkle;
uniform float uVariety;
uniform float uWander;
// A dot colour in OKLab, kept off the surface: too close to it, its lightness flips, and a
// pale colour on a light surface (or a deep one on a dark surface) meets it part-way.
vec3 legible(vec3 c, float ground) {
  vec3 lab = toOklab(c);
  lab.x = mix(lab.x, ground > 0.5 ? 0.2 : 0.97, smoothstep(0.22, 0.1, abs(lab.x - ground)));
  lab.x = ground > 0.5 ? min(lab.x, ground - 0.3) : max(lab.x, ground + 0.3);
  return lab;
}
// One layer of dots, premultiplied; halo gathers the light around them. p is in cells, cell
// is a cell in CSS pixels, z runs 0 (far) to 1 (near, in focus) and past it for the layer in
// front of the focus; keep is how much the pointer's lens shrinks distances here. tints are
// the accent and its two neighbours in hue; shade is how far a plain dot leans to them.
vec4 dots(vec2 p, float cell, float z, float keep, float seed, vec3 ink, mat3 tints, float shade, inout vec3 halo) {
  float spread = clamp(uDepth, 0.0, 1.0);
  float focus = min(z, 1.0), past = max(z - 1.0, 0.0);
  // Far dots are small, faint and soft; near ones large, strong and sharp; the few in front
  // of the focus are wide, soft discs.
  float nearness = mix(1.0, 0.55 + 2.05 * z * z, spread);
  float tone = mix(0.75, mix(0.5, 1.0, focus) * (1.0 - mix(1.95, 2.15, uDark) * past), spread) * uIntensity * uIntro;
  float blur = mix(uSoftness, mix(2.2 * uSoftness, uSoftness * uSoftness, focus) + 2.2 * past, spread);
  float bloom = mix(0.7, mix(0.3, 1.0, focus), spread) * tone;
  // A dot strays this far from where its cell put it, and shows within 0.22 of a cell around
  // itself: under half a cell in all, so the four cells nearest a pixel hold every dot on it.
  float stray = min(uWander * 20.0 * nearness / cell, 0.19);
  float limit = 0.22 + 1.415 * stray;
  vec4 sum = vec4(0);
  vec2 base = floor(p - 0.5);
  for (int j = 0; j < 2; j++) {
    for (int i = 0; i < 2; i++) {
      vec2 id = base + vec2(i, j);
      vec3 h = hash32(id + seed);
      // Too far for it to reach this pixel: skipped before the costly part.
      vec2 gap = p - id - h.xy;
      if (dot(gap, gap) > limit * limit) continue;
      vec3 k = hash32(id * 1.37 + seed + 9.1);
      if (k.z > 0.8) continue;
      // Its own slow, curved path.
      float f = 0.1 + 0.2 * k.x;
      vec2 at = id + h.xy + vec2(sin(uTime * f + h.x * TAU), cos(uTime * f * 0.87 + h.y * TAU)) * stray;
      float span = length(p - at);
      float d = span * cell * uPixelRatio / keep;
      // Most are small, a few twice as wide.
      float r = 0.5 * uSize * nearness * (0.6 + 0.8 * h.z * h.z) * uPixelRatio * mix(0.5, 1.0, uIntro);
      float edge = max(r * blur, 0.75);
      float beat = 1.0 - uTwinkle * 0.7 * (0.5 + 0.5 * sin(uTime * (0.3 + 0.9 * k.y) + k.x * TAU));
      float cut = smoothstep(0.22, 0.16, span);
      float amount = smoothstep(r + edge, r - edge, d) * beat * cut;
      // Its colour: the accent or one of its neighbours for an accent dot, the plain colour
      // (leaning to them on a light surface) for the rest.
      float hue = fract(k.z * 61.3) * 2.0;
      vec3 own = hue < 1.0 ? mix(tints[0], tints[1], hue) : mix(tints[1], tints[2], hue - 1.0);
      own = mix(mix(ink, own, shade), own, step(fract(k.z * 23.7), uAccent));
      // On a dark surface a dot burns a little whiter at its core.
      sum += vec4(mix(own, vec3(1), 0.4 * uDark) * amount, amount);
      // The bloom around it.
      float reach = r * mix(1.8, 2.4, uDark) + edge + 2.5 * uPixelRatio;
      halo += own * exp(-d * d / (reach * reach)) * beat * cut * bloom;
    }
  }
  // Pigment on a light surface is a little thinner than light on a dark one.
  return sum * min(tone * mix(0.9, 1.0, uDark), 1.0 / max(sum.a, 1.0));
}
vec4 scene(vec2 frag) {
  vec2 p = centered(frag);
  vec2 way = vec2(cos(uDirection), sin(uDirection));
  // The pointer parts the dots like a lens: each moves away from it, more the further out it
  // is, up to a reach of 180 pixels.
  vec2 pointer = (uPointer.xy - 0.5 * uResolution) / uPixelRatio;
  vec2 away = p - pointer;
  float lens = 0.25 * clamp(uRepel, 0.0, 2.0) * uPointer.z * (1.0 - smoothstep(0.0, 180.0, length(away)));
  float ground = toOklab(uSurface).x;
  vec3 plain = legible(uColor, ground);
  vec3 tint = legible(uAccentColor, ground);
  // The accent and its neighbours in hue, a turn of its chroma either way.
  mat2 swing = rotate(uVariety * 0.9);
  mat3 tints = mat3(fromOklab(vec3(tint.x, swing * tint.yz)), fromOklab(tint), fromOklab(vec3(tint.x, tint.yz * swing)));
  // On a light surface a grey dot is a speck of dirt: a neutral colour leans to the accent.
  float shade = 0.75 * (1.0 - uDark) * (1.0 - smoothstep(0.02, 0.08, length(plain.yz)));
  // The discs in front are always in the accent's hues, and only when it has one: a grey disc
  // out of focus is a smudge.
  float veil = smoothstep(0.02, 0.08, length(tint.yz));
  vec3 ink = fromOklab(plain);
  vec4 result = vec4(0);
  vec3 halo = vec3(0);
  for (int l = 0; l < 4; l++) {
    float fl = float(l);
    // Far, middle and near, and one layer in front of the focus: 50, 35, 10 and 5% of the
    // count.
    float z = l == 0 ? 0.0 : l == 1 ? 0.45 : l == 2 ? 1.0 : 1.4;
    float share = l == 0 ? 0.5 : l == 1 ? 0.35 : l == 2 ? 0.1 : 0.05;
    float cell = sqrt(737280.0 / (max(uCount, 1.0) * share));
    float pace = 7.0 * uDrift * mix(1.0, min(0.55 + 2.05 * z * z, 2.6), clamp(uDepth, 0.0, 1.0)) / cell;
    mat2 spin = rotate(fl * 0.9 + 0.3);
    // Near layers part further than far ones.
    float keep = 1.0 - lens * mix(0.5, 1.0, min(z, 1.0));
    float show = l == 3 ? veil : 1.0;
    vec3 bloom = vec3(0);
    vec4 layer = dots(spin * (pointer + away * keep) / cell + fl * 17.3 - spin * way * uTime * pace, cell, z, keep, fl * 41.0, ink, tints, l == 3 ? 1.0 : shade, bloom);
    result = over(layer * show, result);
    halo += bloom * show;
  }
  float strength = max(halo.r, max(halo.g, halo.b));
  vec4 lit = glow(strength > 0.0 ? halo / strength : halo, strength * mix(0.24, 0.5, uDark));
  return over(result, lit);
}
`

export type ParticlesProps = {
  accent?: number
  accentColor?: string
  color?: string
  count?: number
  depth?: number
  direction?: number
  drift?: number
  intensity?: number
  repel?: number
  size?: number
  softness?: number
  twinkle?: number
  variety?: number
  wander?: number
}

export function particlesUniforms(p: ParticlesProps) {
  const d = { accent: 0.35, accentColor: '#4f7dff', color: '#f5f5f5', count: 360, depth: 0.8, direction: 40, drift: 1, intensity: 1, repel: 1, size: 4, softness: 0.45, twinkle: 0.4, variety: 0.5, wander: 1, ...p }
  return {
    numbers: {
      uAccent: d.accent,
      uCount: d.count,
      uDepth: d.depth,
      uDirection: (d.direction * Math.PI) / 180,
      uDrift: d.drift,
      uIntensity: d.intensity,
      uRepel: d.repel,
      uSize: d.size,
      uSoftness: d.softness,
      uTwinkle: d.twinkle,
      uVariety: d.variety,
      uWander: d.wander,
    },
    colors: { uAccentColor: d.accentColor, uColor: d.color },
    still: 6,
  }
}

export const PARTICLES_PRESETS: { id: string; ru: string; en: string; props: ParticlesProps }[] = [
  { id: 'dust', ru: 'Пыль', en: 'Dust', props: {} },
  { id: 'classic', ru: 'Классика', en: 'Classic', props: { count: 180, depth: 0, softness: 0.1, twinkle: 0 } },
  { id: 'embers', ru: 'Угли', en: 'Embers', props: { accent: 0.5, accentColor: '#ff4d2e', color: '#ff9a3d', count: 220, direction: 90, drift: 1.6, intensity: 1.5, softness: 0.7, twinkle: 0.8, variety: 0.3 } },
  { id: 'lagoon', ru: 'Лагуна', en: 'Lagoon', props: { accent: 0.5, accentColor: '#a05cff', color: '#19d3c5', count: 420, drift: 0.4, softness: 0.6, wander: 1.8 } },
  { id: 'mono', ru: 'Серебро', en: 'Mono', props: { accent: 0.4, accentColor: '#8a8f98', softness: 0.3, twinkle: 0.2 } },
  { id: 'orbs', ru: 'Шары', en: 'Orbs', props: { accent: 0.5, accentColor: '#a05cff', color: '#4f7dff', count: 90, depth: 0.5, drift: 0.5, size: 8, softness: 1 } },
  { id: 'swarm', ru: 'Рой', en: 'Swarm', props: { accent: 0.2, count: 600, depth: 0.4, drift: 0.3, size: 2, softness: 0.2, wander: 2 } },
]
