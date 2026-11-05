export function FishIcon({ size = 20, stroke = '#fff' }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <path d="M6 32c8-14 20-20 34-14-2 6-2 14 0 20-14 6-26 0-34-14z" stroke={stroke} strokeWidth={2} fill="rgba(255,255,255,0.10)" />
      <path d="M40 25c4-3 9-4 13-2-3 3-3 8 0 11-4 2-9 1-13-2" stroke={stroke} strokeWidth={2} fill="rgba(255,255,255,0.10)" />
      <circle cx="16" cy="29" r="1.7" fill={stroke} />
    </svg>
  )
}

// Small stat-row icons (see ProfileScreen.tsx's hero-stat-grid) — same
// hand-drawn stroke style as ACH_ICONS, distinct set since these sit at a
// smaller size above a number rather than filling a hex badge.
export const STAT_ICONS: Record<'territory' | 'catch' | 'species' | 'followers', React.ReactNode> = {
  territory: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.2 3.5h7.6l4.2 7.3-4.2 7.3H8.2L4 10.8z" />
    </svg>
  ),
  catch: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3.5v9.5a4.5 4.5 0 0 0 9 0" />
      <circle cx="9" cy="3.5" r="1.6" />
    </svg>
  ),
  species: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 14c4-6 9-9 13-6-1 3-1 6 0 9-4 3-9 0-13-3z" />
      <circle cx="7.5" cy="12.2" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  ),
  followers: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.5 2.5-6 6-6s6 2.5 6 6" />
      <circle cx="17" cy="9" r="2.3" />
      <path d="M15.5 14c2.7.3 4.5 2.4 4.5 6" />
    </svg>
  ),
}

// Profile CTA row icons (see ProfileScreen.tsx's profile-cta-row) — redrawn
// as line icons matching the app's own style instead of 🎯/🛍 emoji, which
// render inconsistently across platforms/fonts.
export const CTA_ICONS = {
  target: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  bag: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8h12l-1 12H7z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  ),
}

// Shop category-tab icons (see ShopScreen.tsx's shop-tabs) — redrawn as line
// icons matching the app's own style instead of 🖼/🎨/✨/🗺/⚡ emoji, which
// render inconsistently across platforms/fonts.
export const SHOP_TAB_ICONS = {
  frame: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  ),
  background: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.6" fill="currentColor" stroke="none" />
      <path d="M3 16l5.5-5 4 4 3-3L21 17" />
    </svg>
  ),
  sparkle: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 6c.6 3.4 2.6 5.4 6 6-3.4.6-5.4 2.6-6 6-.6-3.4-2.6-5.4-6-6 3.4-.6 5.4-2.6 6-6z" />
    </svg>
  ),
  skin: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.2 4.7h7.6l4.2 7.3-4.2 7.3H8.2L4 12z" />
    </svg>
  ),
  bolt: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
    </svg>
  ),
  // The slots panel itself: a frame with three reel windows and the payline
  // running through them (SlotsScreen's machine in miniature).
  slots: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path fill="currentColor" fillRule="evenodd" d="M5.5 4.5H18.5A4 4 0 0 1 22.5 8.5V15.5A4 4 0 0 1 18.5 19.5H5.5A4 4 0 0 1 1.5 15.5V8.5A4 4 0 0 1 5.5 4.5ZM5.2 6.7H6.67A1.5 1.5 0 0 1 8.17 8.2V15.8A1.5 1.5 0 0 1 6.67 17.3H5.2A1.5 1.5 0 0 1 3.7 15.8V8.2A1.5 1.5 0 0 1 5.2 6.7ZM11.27 6.7H12.73A1.5 1.5 0 0 1 14.23 8.2V15.8A1.5 1.5 0 0 1 12.73 17.3H11.27A1.5 1.5 0 0 1 9.77 15.8V8.2A1.5 1.5 0 0 1 11.27 6.7ZM17.33 6.7H18.8A1.5 1.5 0 0 1 20.3 8.2V15.8A1.5 1.5 0 0 1 18.8 17.3H17.33A1.5 1.5 0 0 1 15.83 15.8V8.2A1.5 1.5 0 0 1 17.33 6.7Z" />
      <path d="M4.2 12h15.6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity=".55" />
    </svg>
  ),
}

// ---------------------------------------------------------------------------
// Achievement icons (05.11.2026 redraw). One family: 24×24 grid, 1.7 stroke,
// round caps, and a soft «body» fill (currentColor at 18–22 %) behind the
// outline, so a shape reads as an object and not as a few lines. Everything is
// currentColor — the same SVG is orange on the pale hex in the list, white on
// the orange hex in the detail and the unlock popup, grey when locked.
// Every icon keeps to ONE idea: the fish / the hex / the place from the title.
// ---------------------------------------------------------------------------
// dx/dy: nudge so the drawing's own bounding box sits on the middle of the 24×24 grid
// (measured with getBBox in the browser, 05.11) — without it a crown or a sunrise
// looks pushed to one side of the hex.
// scale/sw: the set is balanced by measured ink so no icon looks heavier or lighter than the rest —
// scale about the centre, sw = the line width on screen (the group divides it by the scale).
type AchSvgProps = { width?: number; height?: number; dx?: number; dy?: number; scale?: number; sw?: number; children?: React.ReactNode }
function AchSvg({ width = 24, height = 24, dx = 0, dy = 0, scale = 1, sw = 1.7, children }: AchSvgProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {dx || dy || scale !== 1 || sw !== 1.7 ? (
        <g transform={`translate(${dx} ${dy}) translate(12 12) scale(${scale}) translate(-12 -12)`} strokeWidth={sw / scale}>
          {children}
        </g>
      ) : (
        children
      )}
    </svg>
  )
}

// Soft body fill used behind outlines.
const SOFT = { fill: 'currentColor', fillOpacity: 0.2 } as const
const MID = { fill: 'currentColor', fillOpacity: 0.42 } as const
const SOLID = { fill: 'currentColor', stroke: 'none' } as const

// Flat-top hexagon (the same orientation as the map's sectors), centre + radius.
function hexPath(cx: number, cy: number, r: number): string {
  const h = r * 0.866
  const f = (n: number) => +n.toFixed(2)
  return `M${f(cx + r)} ${f(cy)}L${f(cx + r / 2)} ${f(cy + h)}L${f(cx - r / 2)} ${f(cy + h)}L${f(cx - r)} ${f(cy)}L${f(cx - r / 2)} ${f(cy - h)}L${f(cx + r / 2)} ${f(cy - h)}Z`
}

export const ACH_ICONS: Record<string, React.ReactNode> = {
  // Первый улов — the fish itself, with a «new» spark.
  first: (
    <AchSvg scale={1.04} dy={0.45}>
      <path d="M2.5 13.5C5 9.6 8.6 8 12 8c2.8 0 5 1.2 6.5 3.2L21.5 9v9l-3-2.2C17 17.8 14.8 19 12 19c-3.4 0-7-1.6-9.5-5.5z" {...SOFT} />
      <circle cx="7.4" cy="12.6" r="1" {...SOLID} />
      <path d="M11.5 10.2c1 1.6 1 4.6 0 6.4" />
      <path d="M6.5 2.5v4M4.5 4.5h4" />
    </AchSvg>
  ),
  // Три сектора — three hexes of the map, one of them taken.
  territory: (
    <AchSvg scale={0.9} dx={0.3}>
      <path d={hexPath(7.95, 7.33, 5.4)} {...SOFT} />
      <path d={hexPath(16.05, 12, 5.4)} {...MID} />
      <path d={hexPath(7.95, 16.67, 5.4)} {...SOFT} />
    </AchSvg>
  ),
  // Коллекционер видов — a big fish and a small one of another kind.
  species: (
    <AchSvg scale={1.03} dx={-0.3} dy={0.35}>
      {/* Both fish sit on the vertical axis x=12; the pair is centred in y. */}
      <g transform="translate(1.5 -1.5)">
        <path d="M2.5 9.5c2-3 4.8-4.4 7.8-4.4 2.3 0 4.2.9 5.5 2.4l2.7-1.8v7.6l-2.7-1.8c-1.3 1.5-3.2 2.4-5.5 2.4-3 0-5.8-1.4-7.8-4.4z" {...SOFT} />
        <circle cx="6.2" cy="8.9" r=".9" {...SOLID} />
      </g>
      <g transform="translate(-1.8 -1.5)">
        <path d="M9 19.2c1.1-1.7 2.6-2.5 4.4-2.5 1.3 0 2.4.4 3.2 1.2l2-1.2v5l-2-1.2c-.8.8-1.9 1.2-3.2 1.2-1.8 0-3.3-.8-4.4-2.5z" {...MID} />
      </g>
    </AchSvg>
  ),
  // Ранний рыбак — the sun coming up over the water.
  sunrise: (
    <AchSvg scale={1.04} sw={2.1} dy={-2.1}>
      <path d="M7 16.5a5 5 0 0 1 10 0z" {...MID} />
      <path d="M12 5.5v2.4M5.2 8.7l1.7 1.7M18.8 8.7l-1.7 1.7" />
      <path d="M2.5 16.5h19" />
      <path d="M4.8 20.4q2.4-2.6 4.8 0t4.8 0 4.8 0" />
    </AchSvg>
  ),
  // Личный рекорд 40 см — the cup.
  record: (
    <AchSvg scale={0.99} dy={0.35}>
      <path d="M7 3.5h10v5.5a5 5 0 0 1-10 0z" {...SOFT} />
      <path d="M7 5.5H4.8c-.7 0-1.3.6-1.3 1.3 0 1.4 1.2 2.2 3.5 2.2M17 5.5h2.2c.7 0 1.3.6 1.3 1.3 0 1.4-1.2 2.2-3.5 2.2" />
      <path d="M12 14v3.5" />
      <rect x="8" y="17.5" width="8" height="3.5" rx="1" {...MID} />
    </AchSvg>
  ),
  // Десять уловов — the number, in a medal ring.
  ten: (
    <AchSvg scale={0.88}>
      <circle cx="12" cy="12" r="9" {...SOFT} />
      <path d="M6.5 10.2 8.8 8.5v7" />
      <rect x="11.3" y="8.5" width="5.4" height="7" rx="2.7" />
    </AchSvg>
  ),
  // Универсал — fresh water (the drop) and the sea (the waves).
  universal: (
    <AchSvg scale={1.0} sw={2} dy={-1.1}>
      <path d="M12 2.5c2.6 3 4.2 5.1 4.2 7.2a4.2 4.2 0 0 1-8.4 0c0-2.1 1.6-4.2 4.2-7.2z" {...SOFT} />
      <path d="M4.8 16.8q2.4-2.6 4.8 0t4.8 0 4.8 0" />
      <path d="M4.8 21q2.4-2.6 4.8 0t4.8 0 4.8 0" />
    </AchSvg>
  ),
  // Всеядный — a rod with the reel, line and hook.
  allmethods: (
    <AchSvg scale={1.09} sw={2.1} dx={-1.2} dy={-1.5}>
      <path d="M3.5 20.5 19 5" strokeWidth="2.2" />
      <circle cx="11.2" cy="16.8" r="2.7" {...SOFT} />
      <path d="M9.4 14.8 10.6 14" />
      <path d="M19 5c2 1.8 2.7 4.5 1.9 7.5" />
      <path d="M20.9 12.5v3.2a2.2 2.2 0 0 1-4.4 0" />
      <path d="M16.5 15.7 15.3 14.5" />
    </AchSvg>
  ),
  // Экспериментатор — a spoon lure with its hook.
  allbaits: (
    <AchSvg scale={1.03} sw={2.6} dx={0.75} dy={0.6}>
      <circle cx="16.5" cy="3.8" r="1.5" />
      <path d="M16.5 5.3V15.5a5.5 5.5 0 0 1-11 0v-2.5" />
      <path d="M5.5 13l1.8 1.8" />
      <path d="M6 2v4M4 4h4" />
    </AchSvg>
  ),
  // Обошёл всё побережье — a compass: every kind of water on the map.
  allwaters: (
    <AchSvg scale={0.86}>
      <circle cx="12" cy="12" r="9.2" {...SOFT} />
      <path d="M12 3.4v1.8M12 18.8v1.8M3.4 12h1.8M18.8 12h1.8" />
      <path d="M15.8 8.2 13.7 13.7 8.2 15.8 10.3 10.3z" />
      <path d="M15.8 8.2 13.7 13.7 10.3 10.3z" {...SOLID} />
    </AchSvg>
  ),
  // Тяжеловес — a weight with «1» (kg).
  heavy: (
    <AchSvg scale={1.12} sw={2} dy={-0.45}>
      <g transform="translate(0 -1.4)">
      <path d="M7.5 9h9l2.3 10.2a1.3 1.3 0 0 1-1.3 1.6h-11.0a1.3 1.3 0 0 1-1.3-1.6z" {...SOFT} />
      <path d="M9.4 9v-.6a2.6 2.6 0 0 1 5.2 0V9" />
      <path d="M10.5 13.5 12.3 12.2v5.8" />
      </g>
    </AchSvg>
  ),
  // Гигант — a long fish over a ruler.
  giant: (
    <AchSvg scale={0.8} dx={-0.15} dy={-0.75}>
      <path d="M2 8.5c2.6-3.7 6.2-5.4 10-5.4 2.8 0 5 1 6.6 2.8L22 4v8.8l-3.4-1.9C17 12.7 14.8 13.7 12 13.7c-3.8 0-7.4-1.6-10-5.2z" {...SOFT} />
      <circle cx="6.3" cy="7.6" r=".9" {...SOLID} />
      <rect x="2" y="16.5" width="20" height="5" rx="1.3" {...MID} />
      <path d="M6 16.5v2.3M10 16.5v1.5M14 16.5v2.3M18 16.5v1.5" />
    </AchSvg>
  ),
  // Ночной клёв — the moon and stars.
  nightowl: (
    <AchSvg scale={1.06} sw={2} dx={-0.35} dy={-0.05}>
      <path d="M19.5 14.5A8 8 0 1 1 9.5 4.5a6.4 6.4 0 0 0 10 10z" {...SOFT} />
      <path d="M18.2 2.8v3.8M16.3 4.7h3.8" />
      <path d="M21.2 10.3v2M20.2 11.3h2" />
    </AchSvg>
  ),
  // Постоянный клиент — a heart with the same fish again and again.
  loyal: (
    <AchSvg scale={1.0} dy={-0.25}>
      <path d="M12 20.8C5.6 16.3 3 12.8 3 9.4 3 6.8 5 4.9 7.3 4.9c1.9 0 3.5 1 4.7 2.9 1.2-1.9 2.8-2.9 4.7-2.9C19 4.9 21 6.8 21 9.4c0 3.4-2.6 6.9-9 11.4z" {...SOFT} />
      <g transform="translate(0 1.4)">
        <path d="M7.5 11.8c1-1.5 2.5-2.2 4.2-2.2 1.2 0 2.2.4 3 1.1l1.5-1v4.2l-1.5-1c-.8.7-1.8 1.1-3 1.1-1.7 0-3.2-.7-4.2-2.2z" {...SOLID} />
      </g>
    </AchSvg>
  ),
  // Хозяин побережья — the crown.
  landlord: (
    <AchSvg scale={0.97} dy={-0.5}>
      <path d="M3.2 7.4l4.4 3.6L12 4l4.4 7 4.4-3.6-1.8 9.6H5z" {...SOFT} />
      <path d="M5.5 20.4h13" />
      <path d="M12 12.2l1.4 1.4-1.4 1.4-1.4-1.4z" {...SOLID} />
    </AchSvg>
  ),
  // Известный рыбак — a crowd, the one in the middle in front.
  popular: (
    <AchSvg scale={0.96} dy={-0.75}>
      <circle cx="12" cy="8" r="3.2" {...SOFT} />
      <path d="M6.2 20c0-3.4 2.5-5.6 5.8-5.6s5.8 2.2 5.8 5.6z" {...SOFT} />
      <circle cx="4.7" cy="10.2" r="2" />
      <path d="M1.6 18.5c0-2.3 1.4-3.8 3.1-3.8" />
      <circle cx="19.3" cy="10.2" r="2" />
      <path d="M22.4 18.5c0-2.3-1.4-3.8-3.1-3.8" />
    </AchSvg>
  ),
  // Отбил сектор — a flag planted on a hex taken from someone.
  conqueror: (
    <AchSvg scale={1.0} dx={-1.8} dy={-0.65}>
      <path d={hexPath(12, 17.8, 5.2)} {...MID} />
      <path d="M12 17.8V2.8" />
      <path d="M12 3.4c2.2-1.2 4-.2 6.2.6 1 .4 1.9.4 2.8.1V10c-.9.3-1.8.300-2.8-.1-2.2-.8-4-1.8-6.2-.6z" {...SOFT} />
    </AchSvg>
  ),

}
