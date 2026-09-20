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
]

export function resolveAvatarFrame(id: string | null | undefined): AvatarFrame | null {
  if (!id) return null
  return AVATAR_FRAMES.find((f) => f.id === id) ?? null
}
