import { currentLocale, tnd } from '@/lib/i18n/runtime'
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
  fx?: 'aurora' | 'flame' | 'comet' | 'holo' | 'royal' | 'katran' | 'som' | 'scales' | 'storm'
  // The jackpot frames (never for sale — only the slots' jackpot, each
  // city its own): the city's jackpot fish from the reels swims round the rim.
  swimmer?: string
}

export const AVATAR_FRAMES: AvatarFrame[] = [
  // Новинки 24.11.2026 (shop_items sort_order −4…−1): one cheap, two middle, one dear.
  {
    // «Леска» (300): a ring wound with orange-and-cream fishing line.
    id: 'frame_line',
    get label() {
      return tnd('shopFrame.frame_line')
    },
    ring: 'repeating-conic-gradient(from 8deg, #E8541A 0deg 7deg, #FFF1E4 7deg 11deg, #F7A26B 11deg 15deg, #FFF1E4 15deg 19deg)',
  },
  {
    // «Коралл» (700): pink-to-orange coral, softly glowing.
    id: 'frame_coral',
    get label() {
      return tnd('shopFrame.frame_coral')
    },
    ring: 'conic-gradient(from 200deg, #FF6F91, #FF9671, #FFC75F, #FF9671, #F45B8C, #FFB3A1, #FF6F91)',
    glow: true,
  },
  {
    // «Чешуя» (1 100): silver-teal scale segments turning slowly, the glow breathing behind.
    id: 'frame_scales',
    get label() {
      return tnd('shopFrame.frame_scales')
    },
    ring: 'repeating-conic-gradient(from 0deg, #1F6E7E 0deg 9deg, #5FB7C2 9deg 13deg, #CFF7F1 13deg 15deg, #2A8696 15deg 24deg)',
    fx: 'scales',
  },
  {
    // «Шторм» (1 900): a dark storm ring; lightning flashes strike it in turn.
    id: 'frame_storm',
    get label() {
      return tnd('shopFrame.frame_storm')
    },
    ring: 'conic-gradient(from 0deg, #0A1430, #1C2F66, #3D5BB8, #1C2F66, #0A1430, #23377A, #7EA2FF, #23377A, #0A1430)',
    fx: 'storm',
  },
  {
    id: 'frame_bronze',
    get label() {
      return tnd('shopFrame.frame_bronze')
    },
    ring: 'conic-gradient(from 180deg, #8C5A2B, #C9905A, #8C5A2B, #6E4420, #8C5A2B)',
  },
  {
    id: 'frame_silver',
    get label() {
      return tnd('shopFrame.frame_silver')
    },
    ring: 'conic-gradient(from 180deg, #9CA3AE, #F0F3F7, #9CA3AE, #6B7280, #9CA3AE)',
  },
  {
    id: 'frame_gold',
    get label() {
      return tnd('shopFrame.frame_gold')
    },
    ring: 'conic-gradient(from 180deg, #B8860B, #FFD700, #FFF6C8, #B8860B, #8B6508, #B8860B)',
    glow: true,
  },
  {
    id: 'frame_emerald',
    get label() {
      return tnd('shopFrame.frame_emerald')
    },
    ring: 'conic-gradient(from 180deg, #0E7A4E, #34D399, #0E7A4E, #0A5C3B, #0E7A4E)',
  },
  {
    id: 'frame_sapphire',
    get label() {
      return tnd('shopFrame.frame_sapphire')
    },
    ring: 'conic-gradient(from 180deg, #1E40AF, #60A5FA, #1E40AF, #16307F, #1E40AF)',
  },
  {
    id: 'frame_platinum',
    get label() {
      return tnd('shopFrame.frame_platinum')
    },
    ring: 'conic-gradient(from 180deg, #7C8B9C, #EAF2FA, #C6D3E0, #7C8B9C, #4E5A68, #7C8B9C)',
    glow: true,
  },
  {
    id: 'frame_aurora',
    get label() {
      return tnd('shopFrame.frame_aurora')
    },
    ring: 'conic-gradient(from 0deg, #10D9A0, #22C3EE, #7C5CFF, #F052B4, #7C5CFF, #22C3EE, #10D9A0)',
    fx: 'aurora',
  },
  {
    id: 'frame_flame',
    get label() {
      return tnd('shopFrame.frame_flame')
    },
    ring: 'conic-gradient(from 0deg, #FF3D00, #FF8A00, #FFD23F, #FF8A00, #FF3D00, #C41E00, #FF5A00, #FFB000, #FF3D00)',
    fx: 'flame',
  },
  {
    id: 'frame_comet',
    get label() {
      return tnd('shopFrame.frame_comet')
    },
    ring: 'conic-gradient(from 0deg, #0B1A3A 0deg, #10285A 190deg, #1E5BFF 280deg, #6FD8FF 335deg, #FFFFFF 356deg, #0B1A3A 360deg)',
    fx: 'comet',
  },
  {
    id: 'frame_holo',
    get label() {
      return tnd('shopFrame.frame_holo')
    },
    ring: 'conic-gradient(from 0deg, #FF6FB0, #FFC66F, #FFFFFF 17%, #7CF2CF, #6FB8FF, #A98BFF, #FFFFFF 67%, #FF8FC6, #FF6FB0)',
    fx: 'holo',
  },
  {
    id: 'frame_royal',
    get label() {
      return tnd('shopFrame.frame_royal')
    },
    ring: 'conic-gradient(from 0deg, #8B6508, #FFD700, #FFF6C8, #E8B923, #8B6508, #C99A1A, #FFE680, #FFFBE6, #B8860B, #8B6508)',
    fx: 'royal',
  },
  {
    // Batumi's jackpot: steel-grey like the dogfish, white spots on the rim.
    id: 'frame_katran',
    get label() {
      return tnd('shopFrame.frame_katran')
    },
    ring: 'conic-gradient(from 0deg, #2B313C, #56606F, #B7C2CF, #56606F, #2B313C, #3B4250, #8792A2, #E9EEF3, #3B4250, #2B313C)',
    fx: 'katran',
    swimmer: '/slots/katran.webp',
  },
  {
    // Moscow's jackpot: the river at night — catfish violet into weedy green, bubbles rising.
    id: 'frame_som',
    get label() {
      return tnd('shopFrame.frame_som')
    },
    ring: 'conic-gradient(from 0deg, #26213F, #4B4A7A, #9C9AD0, #4B4A7A, #26213F, #2F4A3C, #6E8F5A, #C8D9A6, #2F4A3C, #26213F)',
    fx: 'som',
    swimmer: '/slots/som.webp',
  },
]

// Which jackpot frame a city's slots give (spin_slots on the server agrees).
export const JACKPOT_FRAME = { batumi: 'frame_katran', moscow: 'frame_som', spb: 'frame_som', sochi: 'frame_katran', tbilisi: 'frame_som', kazan: 'frame_som', nnov: 'frame_som', varna: 'frame_katran', anapa: 'frame_katran', kyiv: 'frame_som', odesa: 'frame_katran', yerevan: 'frame_som' } as const

// The slots' jackpot odds — the same threshold as spin_slots on the server
// (supabase-drafts/slots_odds_free_spin.sql). The pay table and the shop's
// jackpot frames both show it from here.
export const JACKPOT_CHANCE = 0.003
export const jackpotChanceLabel = () => `${(JACKPOT_CHANCE * 100).toLocaleString(currentLocale())}%`

export function resolveAvatarFrame(id: string | null | undefined): AvatarFrame | null {
  if (!id) return null
  return AVATAR_FRAMES.find((f) => f.id === id) ?? null
}
