'use client'

import { tn } from '@/lib/i18n/runtime'

// The sector moments of solo play, as the map plays them after a catch (components/app-shell/LeafletMap.tsx
// runSectorMoment): the same markup and the same classes (.smx in globals.css), drawn here without a map so the
// owner can look at each one. Kept in step with runSectorMoment by hand: change both together.

type Kind = 'capture' | 'steal' | 'attack' | 'own'
const HIT_AT: Record<Kind, number> = { capture: 420, steal: 400, attack: 400, own: 0 }

export type SectorMomentDemo = { kind: Kind; victim?: boolean; fromColor: string; toColor: string; fromName: string | null; toName: string; defense: number }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function sectorMomentHtml(m: SectorMomentDemo, id: string, r: number): string {
  const box = Math.ceil(r * 2 + 8)
  const half = box / 2
  const poly = [0, 1, 2, 3, 4, 5]
    .map((i) => {
      const a = (Math.PI / 3) * i
      return `${(half + r * Math.cos(a)).toFixed(1)},${(half + r * 0.87 * Math.sin(a)).toFixed(1)}`
    })
    .join(' ')
  const clip = `smxp-${m.kind}${m.victim ? 'v' : ''}`
  const fromOpacity = m.kind === 'capture' ? 0.22 : 0.32
  const floods = m.kind === 'capture' || m.kind === 'steal'
  const hitAt = HIT_AT[m.kind]
  const face = (name: string | null, cls: string, ring: string) => `<div class="smx-face ${cls}" style="--smx-ring:${ring}">${esc((name ?? '').slice(0, 2).toUpperCase())}</div>`
  const oldFace = m.kind === 'steal' || m.kind === 'attack' ? face(m.fromName, 'smx-old', m.fromColor) : ''
  const newFace = face(m.toName, 'smx-new', m.kind === 'attack' ? '#E24B4A' : m.toColor)
  const after = floods ? 1 : Math.max(0, Math.min(3, m.defense))
  const changed = m.kind === 'attack' ? after : after - 1
  const pips = [0, 1, 2]
    .map((i) => {
      const on = m.kind === 'attack' ? i <= after : i < after
      const cls = i === changed ? (m.kind === 'attack' ? ' lost' : ' gained') : ''
      return `<span class="${on ? 'on' : ''}${cls}"></span>`
    })
    .join('')
  const label = m.victim
    ? m.kind === 'steal'
      ? tn('map.moment.lost', { id, name: m.toName })
      : tn('map.moment.hitBy', { id, name: m.toName })
    : m.kind === 'capture'
      ? tn('map.moment.captured', { id })
      : m.kind === 'steal'
        ? tn('map.moment.stolen', { id, name: m.fromName ?? '' })
        : m.kind === 'attack'
          ? tn('map.moment.attacked', { id })
          : tn('map.moment.fortified', { id })
  const pipColor = m.kind === 'attack' ? m.fromColor : m.toColor
  return (
    `<div class="smx smx-${m.kind}${m.victim ? ' victim' : ''}" style="--smx-color:${m.toColor};--smx-from:${m.fromColor};--smx-pip:${pipColor};--smx-hit:${hitAt}ms;--smx-r:${Math.round(r)}px">` +
    `<svg class="smx-hex" width="${box}" height="${box}" viewBox="0 0 ${box} ${box}" style="left:${-half}px;top:${-half}px">` +
    `<defs><clipPath id="${clip}"><polygon points="${poly}"/></clipPath></defs>` +
    `<polygon class="smx-hex-old" points="${poly}" fill="${m.fromColor}" fill-opacity="${fromOpacity}" stroke="${m.fromColor}" stroke-opacity=".9" stroke-width="1.5"/>` +
    (floods
      ? `<g clip-path="url(#${clip})"><circle class="smx-flood" cx="${half}" cy="${half}" r="${(r * 1.05).toFixed(1)}" fill="${m.toColor}" fill-opacity=".32"/></g>` +
        `<polygon class="smx-hex-new" points="${poly}" fill="none" stroke="${m.toColor}" stroke-opacity=".9" stroke-width="1.5"/>`
      : `<polygon class="smx-hex-edge" points="${poly}" fill="none" stroke="${m.kind === 'attack' ? '#E24B4A' : m.toColor}" stroke-width="3"/>`) +
    `</svg>` +
    `<span class="smx-ring"></span>` +
    oldFace +
    newFace +
    `<div class="smx-label"><i></i>${esc(label)}</div>` +
    `<div class="smx-pips">${pips}</div></div>`
  )
}

export function SectorMoment({ m, id = 'B1079', r = 70 }: { m: SectorMomentDemo; id?: string; r?: number }) {
  return <div className="art-smx" dangerouslySetInnerHTML={{ __html: sectorMomentHtml(m, id, r) }} />
}
