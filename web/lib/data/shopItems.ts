// Visual catalog for avatar frames — the shop_items DB rows only carry
// id/category/name/price, so the actual look (a conic-gradient ring drawn
// behind the 108px .profile-avatar, see .avatar-frame-ring in globals.css)
// lives here, keyed by the same id the DB row uses. hero_bg items need no
// equivalent catalog: their look already lives in heroBackgrounds.ts, which
// this file's ids (waves/waves-ocean/waves-purple/waves-pink) deliberately
// match.
export type AvatarFrame = {
  id: string
  label: string
  ring: string
  glow?: boolean
  // Premium (800+) frames move: the ring turns, a soft copy of it glows
  // behind, and each has its own extra — see AvatarFrameRing.tsx and
  // .avatar-frame-fx in globals.css.
  fx?: 'aurora' | 'flame' | 'comet' | 'holo' | 'royal' | 'katran' | 'som'
  // The jackpot frames (never for sale — only the slots' jackpot, each
  // city its own): the city's jackpot fish from the reels swims round the rim.
  swimmer?: string
}

export const AVATAR_FRAMES: AvatarFrame[] = [
  {
    id: 'frame_bronze',
    label: 'Бронзовая рамка',
    ring: 'conic-gradient(from 180deg, #8C5A2B, #C9905A, #8C5A2B, #6E4420, #8C5A2B)',
  },
  {
    id: 'frame_silver',
    label: 'Серебряная рамка',
    ring: 'conic-gradient(from 180deg, #9CA3AE, #F0F3F7, #9CA3AE, #6B7280, #9CA3AE)',
  },
  {
    id: 'frame_gold',
    label: 'Золотая рамка',
    ring: 'conic-gradient(from 180deg, #B8860B, #FFD700, #FFF6C8, #B8860B, #8B6508, #B8860B)',
    glow: true,
  },
  {
    id: 'frame_emerald',
    label: 'Изумрудная рамка',
    ring: 'conic-gradient(from 180deg, #0E7A4E, #34D399, #0E7A4E, #0A5C3B, #0E7A4E)',
  },
  {
    id: 'frame_sapphire',
    label: 'Сапфировая рамка',
    ring: 'conic-gradient(from 180deg, #1E40AF, #60A5FA, #1E40AF, #16307F, #1E40AF)',
  },
  {
    id: 'frame_platinum',
    label: 'Платиновая рамка',
    ring: 'conic-gradient(from 180deg, #7C8B9C, #EAF2FA, #C6D3E0, #7C8B9C, #4E5A68, #7C8B9C)',
    glow: true,
  },
  {
    id: 'frame_aurora',
    label: 'Рамка «Северное сияние»',
    ring: 'conic-gradient(from 0deg, #10D9A0, #22C3EE, #7C5CFF, #F052B4, #7C5CFF, #22C3EE, #10D9A0)',
    fx: 'aurora',
  },
  {
    id: 'frame_flame',
    label: 'Рамка «Пламя»',
    ring: 'conic-gradient(from 0deg, #FF3D00, #FF8A00, #FFD23F, #FF8A00, #FF3D00, #C41E00, #FF5A00, #FFB000, #FF3D00)',
    fx: 'flame',
  },
  {
    id: 'frame_comet',
    label: 'Рамка «Комета»',
    ring: 'conic-gradient(from 0deg, #0B1A3A 0deg, #10285A 190deg, #1E5BFF 280deg, #6FD8FF 335deg, #FFFFFF 356deg, #0B1A3A 360deg)',
    fx: 'comet',
  },
  {
    id: 'frame_holo',
    label: 'Рамка «Голограмма»',
    ring: 'conic-gradient(from 0deg, #FF6FB0, #FFC66F, #FFFFFF 17%, #7CF2CF, #6FB8FF, #A98BFF, #FFFFFF 67%, #FF8FC6, #FF6FB0)',
    fx: 'holo',
  },
  {
    id: 'frame_royal',
    label: 'Рамка «Королевская»',
    ring: 'conic-gradient(from 0deg, #8B6508, #FFD700, #FFF6C8, #E8B923, #8B6508, #C99A1A, #FFE680, #FFFBE6, #B8860B, #8B6508)',
    fx: 'royal',
  },
  {
    // Batumi's jackpot: steel-grey like the dogfish, white spots on the rim.
    id: 'frame_katran',
    label: 'Рамка «Катран»',
    ring: 'conic-gradient(from 0deg, #2B313C, #56606F, #B7C2CF, #56606F, #2B313C, #3B4250, #8792A2, #E9EEF3, #3B4250, #2B313C)',
    fx: 'katran',
    swimmer: '/slots/katran.webp',
  },
  {
    // Moscow's jackpot: the river at night — catfish violet into weedy green, bubbles rising.
    id: 'frame_som',
    label: 'Рамка «Сом»',
    ring: 'conic-gradient(from 0deg, #26213F, #4B4A7A, #9C9AD0, #4B4A7A, #26213F, #2F4A3C, #6E8F5A, #C8D9A6, #2F4A3C, #26213F)',
    fx: 'som',
    swimmer: '/slots/som.webp',
  },
]

// Which jackpot frame a city's slots give (spin_slots on the server agrees).
export const JACKPOT_FRAME = { batumi: 'frame_katran', moscow: 'frame_som' } as const

// The slots' jackpot odds — the same threshold as spin_slots on the server
// (supabase-drafts/slots_odds_free_spin.sql). The pay table and the shop's
// jackpot frames both show it from here.
export const JACKPOT_CHANCE = 0.003
export const JACKPOT_CHANCE_LABEL = `${(JACKPOT_CHANCE * 100).toLocaleString('ru')}%`

export function resolveAvatarFrame(id: string | null | undefined): AvatarFrame | null {
  if (!id) return null
  return AVATAR_FRAMES.find((f) => f.id === id) ?? null
}
