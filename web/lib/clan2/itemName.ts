import { tnd } from '@/lib/i18n/runtime'

// A clan shop item's name (skin_wave, boat_gold, frame_legend…): the screens, «Активность» and the bot's messages.
export function itemName(id: string): string {
  if (id.startsWith('skin_')) return tnd(`skin.${id}`)
  return tnd(`clan2.shop.item.${id}`)
}
