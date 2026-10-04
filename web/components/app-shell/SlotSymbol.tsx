import type { SlotSymbol as SymbolId } from '@/lib/supabase/queries'

// Reel symbols for the «Слоты» tab — flat, single-colour silhouettes so they
// read at a glance mid-spin and stay sharp through the motion blur. Drawn
// on a 64×64 grid; each fish faces left, tail right.
const DRAW: Record<SymbolId, React.ReactNode> = {
  // Ставрида: slim body, deep forked tail, the bony scute line along the side.
  stavrida: (
    <g>
      <path d="M5 32c7-9 22-13 36-6l15-9-4 15 4 15-15-9c-14 7-29 3-36-6z" fill="#3E7BFA" />
      <path d="M14 32h28" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="1 3.2" />
      <circle cx="13" cy="29" r="2.6" fill="#fff" />
      <circle cx="13" cy="29" r="1.2" fill="#17181B" />
    </g>
  ),
  // Скорпена: chunky, spiny dorsal fin, big head.
  skorpena: (
    <g>
      <path d="M17 24l3-10 4 9 3-10 4 9 4-8 3 9 4-6 1 8z" fill="#E5533D" />
      <path d="M6 36c1-11 14-16 28-14 6 1 10 3 13 5l11-8-3 15 4 16-12-8c-6 5-16 8-26 6S6 45 6 36z" fill="#E5533D" />
      <path d="M22 42l-4 9 9-6z" fill="#B83A27" />
      <circle cx="15" cy="31" r="3.2" fill="#fff" />
      <circle cx="14.6" cy="31" r="1.5" fill="#17181B" />
    </g>
  ),
  // Луфарь: streamlined, dark back, big jaw.
  lufar: (
    <g>
      <path d="M4 33c8-10 24-13 40-6l14-10-3 16 3 16-14-10c-16 7-32 4-40-6z" fill="#1FA38A" />
      <path d="M10 28c9-6 22-7 34-1-11-2-23-1-34 4z" fill="#13705F" />
      <path d="M4 33l9 2" stroke="#13705F" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="12" cy="30" r="2.4" fill="#fff" />
      <circle cx="12" cy="30" r="1.1" fill="#17181B" />
    </g>
  ),
  // Катран — the jackpot: a small shark, two dorsal fins, white spots, gold edge.
  katran: (
    <g>
      <path d="M3 37c9-7 24-9 39-5l18-11-6 16 5 9-17-4c-15 4-30 2-39-5z" fill="#3B4250" stroke="#E2B13C" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M22 32l7-13 5 13z" fill="#3B4250" stroke="#E2B13C" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M40 33l4-8 3 8z" fill="#3B4250" stroke="#E2B13C" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="27" cy="38" r="1.3" fill="#fff" />
      <circle cx="34" cy="36" r="1.1" fill="#fff" />
      <circle cx="44" cy="37" r="1.2" fill="#fff" />
      <circle cx="11" cy="35" r="1.6" fill="#fff" />
    </g>
  ),
  hook: (
    <g fill="none" stroke="#C9921F" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="38" cy="9" r="4" strokeWidth="4" />
      <path d="M38 13v27a11 11 0 0 1-22 0v-6" />
      <path d="M16 34l-5 6" />
    </g>
  ),
  // Сота — RANGE's own sector shape.
  hex: (
    <g>
      <path d="M32 5l23.4 13.5v27L32 59 8.6 45.5v-27z" fill="#FC5200" />
      <path d="M32 15l14.7 8.5v17L32 49l-14.7-8.5v-17z" fill="none" stroke="#fff" strokeWidth="3" strokeLinejoin="round" />
    </g>
  ),
}

export function SlotSymbol({ symbol, size = 52 }: { symbol: SymbolId; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      {DRAW[symbol]}
    </svg>
  )
}
