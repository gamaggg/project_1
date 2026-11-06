import { crestSvgMarkup } from '@/lib/data/clanCrests'

// The headquarters as a Leaflet marker (an HTML string): the same standing crest as the preview's Hq3D
// (components/clan2/Hq3D.tsx), styled by .c2-hq3d in app/clan2.css, or — after a fall — the ruins.
export function hqMarkerHtml(crest: unknown, opts: { siege: boolean; label: string }): string {
  return `<div class="c2-hq3d c2-hq3d-map${opts.siege ? ' siege' : ''}" aria-label="${opts.label.replace(/"/g, '&quot;')}">
<span class="c2-hq3d-shadow"></span><span class="c2-hq3d-pad"></span><span class="c2-hq3d-pole"></span>
<span class="c2-hq3d-plate"><span class="c2-hq3d-back"></span><span class="c2-hq3d-face">${crestSvgMarkup(crest, 40)}</span></span>
${opts.siege ? '<span class="c2-hq3d-ring"></span>' : ''}</div>`
}

export function ruinsMarkerHtml(label: string): string {
  return `<div class="c2-ruins-marker" aria-label="${label.replace(/"/g, '&quot;')}">
<svg width="46" height="40" viewBox="0 0 46 40" aria-hidden><ellipse cx="23" cy="34" rx="18" ry="4.5" fill="rgba(23,24,27,.25)"/>
<path d="M5 33 L9 15 L16 21 L20 8 L27 19 L33 12 L41 33 z" fill="#A89C86" stroke="#7A705E" stroke-width="1.4"/>
<path d="M22 9 q-5 -8 1 -14" fill="none" stroke="rgba(60,60,60,.5)" stroke-width="3.4" stroke-linecap="round" class="c2-smoke"/></svg></div>`
}
