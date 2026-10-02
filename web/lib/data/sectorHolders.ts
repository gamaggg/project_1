import type { Territory, TerritoryCoHolder } from '@/lib/data/types'

// Who "captured" a sector clan-mates share, as the screens show it: the
// clan-mate who joined it last (coHolders comes oldest share first), or the
// owner while nobody shares it. The database keeps the first capturer as
// owner_id — shields, «Моя» and the parts on the map still follow that.
export function sectorCapturer(t: Territory): TerritoryCoHolder | null {
  const last = t.coHolders[t.coHolders.length - 1]
  if (last) return last
  if (!t.ownerId) return null
  return { id: t.ownerId, avatarUrl: t.ownerAvatarUrl, displayName: t.ownerDisplayName, isMe: t.status === 'mine' }
}

// Everyone else holding the sector, for «Совладельцы»: the owner, then the
// clan-mates who joined before the capturer.
export function sectorOtherHolders(t: Territory): TerritoryCoHolder[] {
  if (!t.ownerId || t.coHolders.length === 0) return []
  const owner = { id: t.ownerId, avatarUrl: t.ownerAvatarUrl, displayName: t.ownerDisplayName, isMe: t.status === 'mine' }
  return [owner, ...t.coHolders.slice(0, -1)]
}

// The capturer first, then everyone else — the avatar row on the map's card.
export function sectorHoldersCapturerFirst(t: Territory): TerritoryCoHolder[] {
  const capturer = sectorCapturer(t)
  return capturer ? [capturer, ...sectorOtherHolders(t)] : []
}
