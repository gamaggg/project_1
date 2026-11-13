import { tnd } from '@/lib/i18n/runtime'

// A clan shop item's name (skin_wave, boat_gold, frame_legend…): the screens, «Активность» and the bot's messages.
export function itemName(id: string): string {
  if (id.startsWith('skin_')) return tnd(`skin.${id}`)
  return tnd(`clan2.shop.item.${id}`)
}

// «купил скин секторов «Трава»»: what kind of thing an item is, for the purchase notices (Telegram and «Активность»).
export function itemKindWord(id: string): string | null {
  if (id.startsWith('skin_')) return tnd('activity.itemKindSkin')
  if (id.startsWith('boat_')) return tnd('activity.itemKindBoat')
  if (id.startsWith('frame_')) return tnd('activity.itemKindFrame')
  return null
}
