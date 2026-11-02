import type { CSSProperties } from 'react'
import type { AwardKind } from '@/lib/data/types'
import { HOT_FLAME_PATH } from '@/lib/map/hotFlame'

// Circular medals, not the hex badges achievements use — a deliberate visual
// split so the two collectible systems never look interchangeable (see the
// awards proposal). The glyphs are filled two-tone drawings: white for the
// figure, the medal's own colour (--c, set by awardMedalStyle) for the cut-outs
// inside it, so every kind reads as its own little emblem, not an outline.

const CUT: CSSProperties = { fill: 'var(--c)' }

const fix = (n: number) => +n.toFixed(2)

function star(cx: number, cy: number, R: number, r: number) {
  return Array.from({ length: 10 }, (_, k) => {
    const a = -Math.PI / 2 + (k * Math.PI) / 5
    const d = k % 2 ? r : R
    return `${fix(cx + d * Math.cos(a))},${fix(cy + d * Math.sin(a))}`
  }).join(' ')
}

// Four-point glint.
function sparkle(cx: number, cy: number, s: number) {
  const k = s * 0.3
  return [
    [cx, cy - s], [cx + k, cy - k], [cx + s, cy], [cx + k, cy + k],
    [cx, cy + s], [cx - k, cy + k], [cx - s, cy], [cx - k, cy - k],
  ].map(([x, y]) => `${fix(x)},${fix(y)}`).join(' ')
}

// One sword, point up, drawn around x=12; the duelist medal crosses two.
const SWORD = (
  <>
    <path d="M12 2.2l1.7 2.3v10.6h-3.4V4.5z" fill="currentColor" />
    <path d="M12 4.6v10" style={{ stroke: 'var(--c)' }} strokeWidth=".9" strokeLinecap="round" opacity=".4" />
    <rect x="7.4" y="15.1" width="9.2" height="2" rx="1" fill="currentColor" opacity=".85" />
    <rect x="10.9" y="17" width="2.2" height="3.4" fill="currentColor" opacity=".7" />
    <circle cx="12" cy="21.2" r="1.3" fill="currentColor" />
  </>
)

export const AWARD_ICONS: Record<AwardKind, React.ReactNode> = {
  // Weekly top: a trophy with the rank star in the cup.
  weekly_rank: (
    <svg viewBox="0 0 24 24">
      <path d="M7.2 5H4.6v2.1c0 2.2 1.4 3.7 3.2 4.1M16.8 5h2.6v2.1c0 2.2-1.4 3.7-3.2 4.1" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" opacity=".7" />
      <path d="M7 3.2h10v5.5c0 3.1-2.2 5.4-5 5.4s-5-2.3-5-5.4z" fill="currentColor" />
      <path d="M12 3.2h5v5.5c0 3.1-2.2 5.4-5 5.4z" fill="#000" opacity=".1" />
      <path d="M10.8 14h2.4v3h-2.4z" fill="currentColor" opacity=".8" />
      <rect x="7.8" y="17" width="8.4" height="3.4" rx="1.1" fill="currentColor" />
      <polygon points={star(12, 8.5, 3.3, 1.4)} style={CUT} />
    </svg>
  ),
  // The sector's guardian: a shield with a star on a field of the medal's colour.
  guardian: (
    <svg viewBox="0 0 24 24">
      <path d="M12 2.4l8 3v6.1c0 5.2-3.6 8.6-8 10.1-4.4-1.5-8-4.9-8-10.1V5.4z" fill="currentColor" />
      <path d="M12 4.9l5.6 2.1v4.6c0 3.7-2.4 6.2-5.6 7.5-3.2-1.3-5.6-3.8-5.6-7.5V7z" style={CUT} />
      <path d="M12 4.9v14.2c-3.2-1.3-5.6-3.8-5.6-7.5V7z" fill="#fff" opacity=".22" />
      <polygon points={star(12, 11.9, 3.4, 1.45)} fill="currentColor" />
    </svg>
  ),
  // Catch of the month: a big fish over a measuring rule.
  catch_of_month: (
    <svg viewBox="0 0 24 24">
      <g transform="translate(0 -1.5)">
        <path d="M9.4 7.3 11.2 4.7c1.2.1 2.2.8 2.8 1.8l-.6 1.4z" fill="currentColor" opacity=".85" />
        <path d="M2.4 11.6c2.2-3.7 6.1-5.3 9.8-4.7 2.3.4 4.1 1.6 5.3 3.2l3.7-2.9c.5-.4 1.1 0 1 .6l-.8 3.8.8 3.8c.1.6-.5 1-1 .6l-3.7-2.9c-1.2 1.6-3 2.8-5.3 3.2-3.7.6-7.6-1-9.8-4.7z" fill="currentColor" />
        <path d="M17.5 10.1l3.7-2.9c.5-.4 1.1 0 1 .6l-.8 3.8.8 3.8c.1.6-.5 1-1 .6l-3.7-2.9z" fill="#000" opacity=".12" />
        <path d="M9.6 8.4c1.2 1.9 1.2 4.4 0 6.3" fill="none" style={{ stroke: 'var(--c)' }} strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="6.3" cy="10.8" r="1.1" style={CUT} />
      </g>
      <rect x="3.6" y="17.6" width="16.8" height="3.3" rx="1" fill="currentColor" />
      <path d="M6.2 17.6v1.6M9.1 17.6v1M12 17.6v1.6M14.9 17.6v1M17.8 17.6v1.6" style={{ stroke: 'var(--c)' }} strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  ),
  // Lightning: a bolt with glints.
  lightning: (
    <svg viewBox="0 0 24 24">
      <path d="M13.2 2L4.6 13.8h5.5L8.9 22l9.4-12.4h-5.7z" fill="currentColor" />
      <path d="M13.2 2l-2.6 11.8h-6L13.2 2z" fill="#fff" opacity=".35" />
      <polygon points={sparkle(19.2, 5, 2.6)} fill="currentColor" />
      <polygon points={sparkle(4.8, 5.4, 1.6)} fill="currentColor" opacity=".8" />
      <circle cx="20" cy="17.6" r=".95" fill="currentColor" opacity=".7" />
    </svg>
  ),
  // Season legend: a big flame with an inner flame cut out of it, the
  // right half shaded and glints around it, drawn like the other medals.
  season_legend: (
    <svg viewBox="0 0 24 24">
      <path d="M12 2.4c.6 2.6 2.6 4.3 4.3 6.2 1.6 1.8 2.6 3.7 2.6 6 0 3.9-3.1 6.9-6.9 6.9s-6.9-3-6.9-6.9c0-2.6 1.3-4.6 2.8-6.1.2 1.6 1 2.6 2.1 3.1-.6-3.3.6-6.6 2-9.2z" fill="currentColor" />
      <path d="M12 2.4c.6 2.6 2.6 4.3 4.3 6.2 1.6 1.8 2.6 3.7 2.6 6 0 3.9-3.1 6.9-6.9 6.9z" fill="#000" opacity=".1" />
      <path d="M12 11.3c.9 1.9 3.3 3.1 3.3 5.8 0 1.9-1.5 3.4-3.3 3.4s-3.3-1.5-3.3-3.4c0-1.3.6-2.2 1.4-3 .2.9.7 1.4 1.3 1.6-.2-1.6.1-3.1.6-4.4z" style={CUT} />
      <polygon points={sparkle(19.6, 4.4, 2.2)} fill="currentColor" />
      <polygon points={sparkle(4.4, 6, 1.4)} fill="currentColor" opacity=".8" />
    </svg>
  ),
  // Night watch: a crescent with stars.
  night_watch: (
    <svg viewBox="0 0 24 24">
      <path d="M20.2 14.6A8.6 8.6 0 1 1 9.4 3.8a7.1 7.1 0 1 0 10.8 10.8z" fill="currentColor" />
      <path d="M9.4 3.8a7.1 7.1 0 0 0-2.4 11.4 7.1 7.1 0 0 0 10.4 1.5 8.6 8.6 0 0 1-8-12.9z" fill="#000" opacity=".1" />
      <polygon points={sparkle(17.4, 6.4, 2.7)} fill="currentColor" />
      <polygon points={sparkle(21, 10.4, 1.5)} fill="currentColor" opacity=".85" />
      <circle cx="13.6" cy="3.6" r=".9" fill="currentColor" opacity=".7" />
    </svg>
  ),
  // Duelist: two swords crossed.
  duelist: (
    <svg viewBox="0 0 24 24">
      <g transform="rotate(-45 12 12)">{SWORD}</g>
      <g transform="rotate(45 12 12)">{SWORD}</g>
      <polygon points={sparkle(12, 12, 2.2)} fill="currentColor" />
    </svg>
  ),
  // The clan's long racing boat crossing first (the regatta boat, see
  // RaceBoat.tsx): a hull with raised ends, three rowers, the leader standing
  // at the bow with his arms up, a wake behind.
  clan_race_winner: (
    <svg viewBox="0 0 24 24">
      <path d="M1.8 10.4c.5 3.2 2.3 4.5 5.2 4.5h10c3.2 0 4.7-2.4 5.4-6.4.5 5.8-1.6 9.6-5.6 9.6H7.3c-3.6 0-5.1-2.4-5.5-7.7Z" fill="currentColor" />
      <path d="M2 11.6c.8 1.6 2.4 2.1 5 2.1h10c2.4 0 3.8-.9 4.7-2.7l-.3 1.9c-.9 1.5-2.2 2.1-4.4 2.1H7c-2.5 0-4-.6-5-3.4Z" fill="#000" opacity=".14" />
      <circle cx="6.6" cy="9.6" r="1.4" fill="currentColor" />
      <circle cx="10" cy="9.6" r="1.4" fill="currentColor" />
      <circle cx="13.4" cy="9.6" r="1.4" fill="currentColor" />
      <path d="M6.4 14V11.3M9.8 14V11.3M13.2 14V11.3" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M8 11.8 4.6 18.6M11.4 11.8 8 18.6M14.8 11.8 11.4 18.6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" fill="none" />
      <circle cx="18.2" cy="4.6" r="1.6" fill="currentColor" />
      <path d="M18.2 6.6v6.6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M18.2 8 20.9 4.8M18.2 8 15.5 4.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M1.8 21.8c1.6-1.1 3.2-1.1 4.8 0s3.2 1.1 4.8 0 3.2-1.1 4.8 0 3.2 1.1 4.8 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" opacity=".6" />
    </svg>
  ),
  // Held a hot sector to the end of the week (settle_hot_sectors): the
  // sector's hexagon (regular, flat-top, as the map draws it) with the
  // hot-sector flame inside — the same flame as on the map
  // (lib/map/hotFlame.ts), so it reads as «that» sector.
  hot_sector: (
    <svg viewBox="0 0 24 24">
      <path d="M6.8 3h10.4l5.2 9-5.2 9H6.8l-5.2-9z" fill="currentColor" strokeLinejoin="round" />
      <path transform="translate(4.08 2.76) scale(.66)" style={CUT} d={HOT_FLAME_PATH} />
    </svg>
  ),
}

export const AWARD_COLOR: Record<AwardKind, { color: string; colorHi: string }> = {
  weekly_rank: { color: '#F0A93E', colorHi: '#FFE7BE' },
  guardian: { color: '#2F9E8F', colorHi: '#B7F2E6' },
  catch_of_month: { color: '#8B5CF6', colorHi: '#E4D9FF' },
  lightning: { color: '#F2C230', colorHi: '#FFF3C4' },
  season_legend: { color: '#FC5200', colorHi: '#FFD3B8' },
  night_watch: { color: '#3B4B9E', colorHi: '#C9D0F2' },
  duelist: { color: '#E0483E', colorHi: '#FFD3CF' },
  clan_race_winner: { color: '#1E8FB5', colorHi: '#BFEAF7' },
  hot_sector: { color: '#D7261E', colorHi: '#FFB38A' },
}

// The colours the .award-medal rim, gloss and glyph cut-outs are drawn from.
export function awardMedalStyle(kind: AwardKind): CSSProperties {
  const { color, colorHi } = AWARD_COLOR[kind]
  return { '--c': color, '--ch': colorHi } as CSSProperties
}

// Every medal kind, in the order the ring lays them out.
export const AWARD_KINDS = Object.keys(AWARD_COLOR) as AwardKind[]

// A medal kind this build doesn't know yet (added server-side before the
// client that draws it shipped) is skipped rather than crashing the ring.
export function isKnownAward(kind: string): kind is AwardKind {
  return kind in AWARD_COLOR
}
