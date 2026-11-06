import { crestSvgMarkup, resolveCrest } from '@/lib/data/clanCrests'

// The headquarters on the map, in the game's own manner (clean shapes, white outlines, soft shadow, the dark pill
// of the sector labels): the clan's banner on a slim white pole over a small hexagonal plinth, with a «ШТАБ» pill
// under it when the map is close. No textures. It grows with the zoom — far: a small banner without the pill, then
// the full one. Tier: 0 far, 1 middle, 2 near. The anchor is the foot of the plinth.
export type MarkerTier = 0 | 1 | 2

export const hqTier = (zoom: number): MarkerTier => (zoom < 13 ? 0 : zoom < 15 ? 1 : 2)
// The banner itself (a bit bigger than the 30 px crests of the other clan sectors); the «ШТАБ» label under it is
// part of the marker from the middle zoom on. HQ_BOX is the whole marker, the anchor is its centre — the same as a
// crest with its label on a plain sector, so the HQ sits in the middle of its hexagon.
const BANNER: Record<MarkerTier, [number, number]> = { 0: [22, 22], 1: [42, 56], 2: [60, 80] }
const LABEL_H = 20
export const HQ_BOX: Record<MarkerTier, [number, number]> = {
  0: BANNER[0],
  1: [BANNER[1][0], BANNER[1][1] + LABEL_H],
  2: [BANNER[2][0], BANNER[2][1] + LABEL_H],
}
export const RUINS_SIZE: Record<MarkerTier, [number, number]> = { 0: [24, 21], 1: [36, 31], 2: [48, 42] }

// The banner, drawn in a 120 x 160 box.
function standardSvg(crest: unknown, w: number, h: number): string {
  const c = resolveCrest(crest)
  return `<svg class="c2-hqm-svg" viewBox="0 0 120 160" width="${w}" height="${h}" overflow="visible" aria-hidden="true">
<ellipse cx="60" cy="146" rx="34" ry="7" fill="rgba(23,24,27,.28)"/>
<path d="M26 138 L42 126 H78 L94 138 L78 150 H42 Z" fill="#fff" stroke="${c.primary}" stroke-width="3" stroke-linejoin="round"/>
<path d="M36 138 L46 131 H74 L84 138 L74 145 H46 Z" fill="${c.primary}" opacity=".16"/>
<rect x="57.6" y="14" width="4.8" height="118" rx="2.4" fill="#fff" stroke="rgba(23,24,27,.35)" stroke-width="1"/>
<circle cx="60" cy="12" r="5.4" fill="#FC5200" stroke="#fff" stroke-width="2"/>
<g class="c2-hqm-banner" style="transform-origin:60px 24px">
<rect x="22" y="20" width="76" height="8" rx="4" fill="#fff" stroke="rgba(23,24,27,.3)" stroke-width="1"/>
<path d="M30 28 H90 V104 L60 92 L30 104 Z" fill="${c.primary}" stroke="#fff" stroke-width="3.4" stroke-linejoin="round"/>
<path d="M36 34 H84 V94 L60 84 L36 94 Z" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="1.4" stroke-linejoin="round"/>
<g transform="translate(36 41)">${crestSvgMarkup(crest, 48)}</g>
</g>
</svg>`
}

export function hqMarkerHtml(crest: unknown, opts: { siege: boolean; label: string; tag: string; tier: MarkerTier }): string {
  // Far away: a round badge in the manner of the hot sector's flame — the clan's colour, a white ring, a small banner.
  if (opts.tier === 0) {
    const c = resolveCrest(crest)
    return `<div class="c2-hqm-b tier0${opts.siege ? ' siege' : ''}" style="width:22px;height:22px" aria-label="${opts.label.replace(/"/g, '&quot;')}">${opts.siege ? '<span class="c2-hqm-alarm"></span>' : ''}<span class="c2-hqm-dot" style="background:${c.primary};box-shadow:0 0 0 2px #fff, 0 3px 10px ${c.primary}8C"><svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.5v11" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/><path d="M3.6 2.2h7.2l-1.7 2.9 1.7 2.9H3.6z" fill="#fff"/></svg></span></div>`
  }
  const [w, h] = BANNER[opts.tier]
  const [bw, bh] = HQ_BOX[opts.tier]
  const tag = `<span class="c2-hqm-label">${opts.tag.replace(/</g, '&lt;')}</span>`
  return `<div class="c2-hqm-b tier${opts.tier}${opts.siege ? ' siege' : ''}" style="width:${bw}px;height:${bh}px" aria-label="${opts.label.replace(/"/g, '&quot;')}">${opts.siege ? '<span class="c2-hqm-alarm"></span>' : ''}${standardSvg(crest, w, h)}${tag}</div>`
}

export function ruinsMarkerHtml(label: string, tier: MarkerTier = 2): string {
  const [w, h] = RUINS_SIZE[tier]
  return `<div class="c2-ruins-marker" aria-label="${label.replace(/"/g, '&quot;')}">
<svg width="${w}" height="${h}" viewBox="0 0 46 40" aria-hidden><ellipse cx="23" cy="34" rx="18" ry="4.5" fill="rgba(23,24,27,.25)"/>
<path d="M5 33 L9 15 L16 21 L20 8 L27 19 L33 12 L41 33 z" fill="#A89C86" stroke="#7A705E" stroke-width="1.4"/>
<path d="M22 9 q-5 -8 1 -14" fill="none" stroke="rgba(60,60,60,.5)" stroke-width="3.4" stroke-linecap="round" class="c2-smoke"/></svg></div>`
}
