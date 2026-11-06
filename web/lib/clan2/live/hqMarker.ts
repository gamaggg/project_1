import { crestSvgMarkup } from '@/lib/data/clanCrests'

// The headquarters as a marker of the map: the clan's crest in a gold ring, a crown over it when the map is close
// and a «ШТАБ» tag under it. It grows with the zoom — from a small gold dot-crest on the far map to the full badge —
// so it never looks big against the sectors. Styled by .c2-hqm in app/clan2.css. Tier: 0 far, 1 middle, 2 near.
export type MarkerTier = 0 | 1 | 2

export const hqTier = (zoom: number): MarkerTier => (zoom < 13 ? 0 : zoom < 15 ? 1 : 2)
export const HQ_SIZE: Record<MarkerTier, number> = { 0: 22, 1: 32, 2: 46 }
export const RUINS_SIZE: Record<MarkerTier, [number, number]> = { 0: [24, 21], 1: [36, 31], 2: [48, 42] }

const CROWN = '<svg viewBox="0 0 32 20" aria-hidden><path d="M3 18 1.5 5 9 10.5 16 2l7 8.5L30.5 5 29 18z" fill="#F0B53E" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/><circle cx="16" cy="2.6" r="1.8" fill="#fff"/></svg>'

export function hqMarkerHtml(crest: unknown, opts: { siege: boolean; label: string; tag: string; tier: MarkerTier }): string {
  const size = HQ_SIZE[opts.tier]
  return `<div class="c2-hqm tier${opts.tier}${opts.siege ? ' siege' : ''}" style="--w:${size}px" aria-label="${opts.label.replace(/"/g, '&quot;')}">
<span class="c2-hqm-halo"></span><span class="c2-hqm-ring"></span><span class="c2-hqm-crest">${crestSvgMarkup(crest, size)}</span>${opts.tier === 2 ? `<span class="c2-hqm-crown">${CROWN}</span><span class="c2-hqm-tag">${opts.tag}</span>` : ''}</div>`
}

export function ruinsMarkerHtml(label: string, tier: MarkerTier = 2): string {
  const [w, h] = RUINS_SIZE[tier]
  return `<div class="c2-ruins-marker" aria-label="${label.replace(/"/g, '&quot;')}">
<svg width="${w}" height="${h}" viewBox="0 0 46 40" aria-hidden><ellipse cx="23" cy="34" rx="18" ry="4.5" fill="rgba(23,24,27,.25)"/>
<path d="M5 33 L9 15 L16 21 L20 8 L27 19 L33 12 L41 33 z" fill="#A89C86" stroke="#7A705E" stroke-width="1.4"/>
<path d="M22 9 q-5 -8 1 -14" fill="none" stroke="rgba(60,60,60,.5)" stroke-width="3.4" stroke-linecap="round" class="c2-smoke"/></svg></div>`
}
