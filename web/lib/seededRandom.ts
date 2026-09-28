// Deterministic "random" for decoration (confetti bursts): the same seed
// always gives the same sequence, so rendering stays pure — React may render
// a component twice, and Math.random() there would give two different
// bursts — while different seeds (an award, an achievement, a player) still
// look random. mulberry32: tiny, fast, well-spread.
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// FNV-1a over the string form — any id or key becomes a seed.
export function seedFrom(value: string | number): number {
  const s = String(value)
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}
