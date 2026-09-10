import type { AwardKind } from '@/lib/data/types'
import { ACH_ICONS } from '@/components/app-shell/icons'

// Circular medals, not the hex badges achievements use — a deliberate visual
// split so the two collectible systems never look interchangeable (see the
// awards proposal). weekly_rank reuses ACH_ICONS.first (same trophy already
// used for "Первый улов") rather than a new glyph.
export const AWARD_ICONS: Record<AwardKind, React.ReactNode> = {
  weekly_rank: ACH_ICONS.first,
  guardian: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l7 3v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6l7-3z" />
    </svg>
  ),
  catch_of_month: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="8" width="20" height="8" rx="1.5" />
      <path d="M6 8v3M10 8v3M14 8v2M18 8v3" />
    </svg>
  ),
  lightning: (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />
    </svg>
  ),
  season_legend: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21c4 0 6.5-2.7 6.5-6.3 0-2.8-1.6-5-2.8-6.2.2 1.7-.8 2.5-1.6 1.7.3-2.2-.9-4.4-2.6-5.4.7 2.1-.8 3.5-2.1 5.1C7.9 11.6 7 13 7 14.7 7 18.3 9.5 21 12 21z" />
    </svg>
  ),
  night_watch: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 1 0 10.5 10.5z" />
    </svg>
  ),
  duelist: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 5l14 14M19 5L5 19" />
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
}
