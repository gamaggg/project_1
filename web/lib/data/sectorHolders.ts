import type { Territory, TerritoryCoHolder } from '@/lib/data/types'

// The owner, then the clan-mates sharing the sector, oldest share first.
function sectorHolders(t: Territory): TerritoryCoHolder[] {
  if (!t.ownerId) return []
  const owner = { id: t.ownerId, avatarUrl: t.ownerAvatarUrl, displayName: t.ownerDisplayName, isMe: t.status === 'mine' }
  return [owner, ...t.coHolders]
}

// Who "captured" a sector clan-mates share, as the screens show it: the
// holder whose catch here is the freshest (capturerId, worked out by the
// database), or the owner while nobody shares it. Without capturerId (the
// guest preview) it falls back to the clan-mate who joined last. The database keeps the
// first capturer as owner_id — shields, «Моя» and the parts on the map
// still follow that.
export function sectorCapturer(t: Territory): TerritoryCoHolder | null {
  const holders = sectorHolders(t)
  if (holders.length === 0) return null
  return holders.find((h) => h.id === t.capturerId) ?? holders[holders.length - 1]
}

// Everyone else holding the sector, for «Совладельцы»: the owner first,
// then the clan-mates in the order they joined.
export function sectorOtherHolders(t: Territory): TerritoryCoHolder[] {
  if (t.coHolders.length === 0) return []
  const capturer = sectorCapturer(t)
  return sectorHolders(t).filter((h) => h.id !== capturer?.id)
}

// The capturer first, then everyone else — the avatar row on the map's card.
export function sectorHoldersCapturerFirst(t: Territory): TerritoryCoHolder[] {
  const capturer = sectorCapturer(t)
  return capturer ? [capturer, ...sectorOtherHolders(t)] : []
}
