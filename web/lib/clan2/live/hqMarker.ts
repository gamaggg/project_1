import { crestSvgMarkup, resolveCrest } from '@/lib/data/clanCrests'

// The headquarters on the map, in the game's own manner (clean shapes, white outlines, soft shadow, the dark pill
// of the sector labels): the clan's banner on a slim white pole over a small hexagonal plinth, with a «ШТАБ» pill
// under it when the map is close. No textures. It grows with the zoom — far: a small banner without the pill, then
// the full one. Tier: 0 far, 1 middle, 2 near. The anchor is the foot of the plinth.
export type MarkerTier = 0 | 1 | 2

export const hqTier = (zoom: number): MarkerTier => (zoom < 13 ? 0 : zoom < 15 ? 1 : 2)
// Far (the other sectors show no crests or labels): a round badge like the hot sector's. Closer: the banner with the
// «ШТАБ» label under it, as one group centred on the sector (the anchor is its centre — the same as a crest with its
// label on a plain sector). The banner is fitted to the sector on screen so the group stays inside its hexagon.
const BADGE = 22
const LABEL_H = 20 // the label's 17 px and the 3 px gap, the same as under a crest on a plain sector
export const BANNER_H_MIN = 44
export const BANNER_H_MAX = 77
const bannerW = (h: number) => Math.round((h * 84) / 124)
// hexPx: the height of the sector's hexagon on the screen (0 — unknown, the largest banner).
export function fitBannerH(hexPx: number): number {
  if (!hexPx) return BANNER_H_MAX
  return Math.round(Math.min(BANNER_H_MAX, Math.max(BANNER_H_MIN, hexPx * 0.78 - LABEL_H)))
}
export function hqBox(tier: MarkerTier, bannerH: number = BANNER_H_MAX): [number, number] {
  return tier === 0 ? [BADGE, BADGE] : [bannerW(bannerH), bannerH + LABEL_H]
}
export const RUINS_SIZE: Record<MarkerTier, [number, number]> = { 0: [24, 21], 1: [36, 31], 2: [48, 42] }

// The banner, drawn in an 84 x 124 box (x from 18): about a third wider than the 30 px crest beside it.
export function hqBannerSvg(crest: unknown, w: number, h: number): string {
  const c = resolveCrest(crest)
  return `<svg class="c2-hqm-svg" viewBox="18 0 84 124" width="${w}" height="${h}" overflow="visible" aria-hidden="true">
<ellipse cx="60" cy="118" rx="34" ry="6" fill="rgba(23,24,27,.28)"/>
<path d="M26 112 L40 103 H80 L94 112 L80 121 H40 Z" fill="#fff" stroke="${c.primary}" stroke-width="3" stroke-linejoin="round"/>
<path d="M36 112 L45 107 H75 L84 112 L75 117 H45 Z" fill="${c.primary}" opacity=".16"/>
<rect x="57.6" y="14" width="4.8" height="94" rx="2.4" fill="#fff" stroke="rgba(23,24,27,.35)" stroke-width="1"/>
<circle cx="60" cy="11" r="5.4" fill="#FC5200" stroke="#fff" stroke-width="2"/>
<g class="c2-hqm-banner" style="transform-origin:60px 24px">
<rect x="22" y="20" width="76" height="8" rx="4" fill="#fff" stroke="rgba(23,24,27,.3)" stroke-width="1"/>
<path d="M30 28 H90 V98 L60 86 L30 98 Z" fill="${c.primary}" stroke="#fff" stroke-width="3.4" stroke-linejoin="round"/>
<g transform="translate(38 35)">${crestSvgMarkup(crest, 44)}</g>
</g>
</svg>`
}

export function hqMarkerHtml(crest: unknown, opts: { siege: boolean; label: string; tag: string; tier: MarkerTier; bannerH?: number }): string {
  // Far away: a round badge in the manner of the hot sector's flame — the clan's colour, a white ring, a small banner.
  if (opts.tier === 0) {
    const c = resolveCrest(crest)
    return `<div class="c2-hqm-b tier0${opts.siege ? ' siege' : ''}" style="width:22px;height:22px" aria-label="${opts.label.replace(/"/g, '&quot;')}">${opts.siege ? '<span class="c2-hqm-alarm"></span>' : ''}<span class="c2-hqm-dot" style="background:${c.primary};box-shadow:0 0 0 2px #fff, 0 3px 10px ${c.primary}8C"><svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.5v11" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/><path d="M3.6 2.2h7.2l-1.7 2.9 1.7 2.9H3.6z" fill="#fff"/></svg></span></div>`
  }
  const h = opts.bannerH ?? BANNER_H_MAX
  const w = bannerW(h)
  const [bw, bh] = hqBox(opts.tier, h)
  const tag = `<span class="leaflet-territory-label c2-hqm-label">${opts.tag.replace(/</g, '&lt;')}</span>`
  return `<div class="c2-hqm-b tier${opts.tier}${opts.siege ? ' siege' : ''}" style="width:${bw}px;height:${bh}px" aria-label="${opts.label.replace(/"/g, '&quot;')}">${opts.siege ? '<span class="c2-hqm-alarm"></span>' : ''}${hqBannerSvg(crest, w, h)}${tag}</div>`
}

export function ruinsMarkerHtml(label: string, tier: MarkerTier = 2): string {
  const [w, h] = RUINS_SIZE[tier]
  return `<div class="c2-ruins-marker" aria-label="${label.replace(/"/g, '&quot;')}">
<svg width="${w}" height="${h}" viewBox="0 0 46 40" aria-hidden><ellipse cx="23" cy="34" rx="18" ry="4.5" fill="rgba(23,24,27,.25)"/>
<path d="M5 33 L9 15 L16 21 L20 8 L27 19 L33 12 L41 33 z" fill="#A89C86" stroke="#7A705E" stroke-width="1.4"/>
<path d="M22 9 q-5 -8 1 -14" fill="none" stroke="rgba(60,60,60,.5)" stroke-width="3.4" stroke-linecap="round" class="c2-smoke"/></svg></div>`
}

// The outline of the HQ sector on the map: the clan's own colour, darker (the way a hot sector has its orange one).
export function hqOutlineColor(crest: unknown): string {
  const hex = resolveCrest(crest).primary.replace('#', '')
  const n = parseInt(hex.length === 3 ? hex.replace(/./g, '$&$&') : hex, 16)
  const mix = (c: number) => Math.round(c * 0.55)
  return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`
}
