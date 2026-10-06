import type { ShopItem } from '@/lib/supabase/queries'

// The premium (800–2000) shop items, as rows the release migration adds to
// shop_items (supabase-drafts/release/premium_shop_items.sql,
// release/jackpot_frames.sql). Until then the
// live table doesn't have them — today's prod client has no visuals for these
// ids — so in development only the Shop appends whichever are missing, to
// look at them. Buying one locally fails: there's no row to buy yet.
// Delete this file (and its use in ShopScreen) once the release is applied.
export const PREMIUM_SHOP_PREVIEW: ShopItem[] = [
  { id: 'frame_aurora', category: 'avatar_frame', name: 'Рамка «Северное сияние»', price: 800, purchasable: true },
  { id: 'frame_flame', category: 'avatar_frame', name: 'Рамка «Пламя»', price: 1000, purchasable: true },
  { id: 'frame_comet', category: 'avatar_frame', name: 'Рамка «Комета»', price: 1200, purchasable: true },
  { id: 'frame_holo', category: 'avatar_frame', name: 'Рамка «Голограмма»', price: 1500, purchasable: true },
  { id: 'frame_royal', category: 'avatar_frame', name: 'Рамка «Королевская»', price: 2000, purchasable: true },
  // The jackpot frames (release/jackpot_frames.sql) — prizes, not for sale.
  { id: 'frame_katran', category: 'avatar_frame', name: 'Рамка «Катран»', price: 5000, purchasable: false },
  { id: 'frame_som', category: 'avatar_frame', name: 'Рамка «Сом»', price: 5000, purchasable: false },
  { id: 'deepwater', category: 'hero_bg', name: 'Глубина', price: 800, purchasable: true },
  { id: 'moonpath', category: 'hero_bg', name: 'Лунная дорожка', price: 1000, purchasable: true },
  { id: 'school', category: 'hero_bg', name: 'Косяк', price: 1500, purchasable: true },
  { id: 'golddust', category: 'hero_bg', name: 'Золотая пыль', price: 2000, purchasable: true },
  { id: 'name_aurora', category: 'name_style', name: 'Имя «Северное сияние»', price: 800, purchasable: true },
  { id: 'name_lava', category: 'name_style', name: 'Имя «Лава»', price: 1000, purchasable: true },
  { id: 'name_holo', category: 'name_style', name: 'Имя «Голограмма»', price: 1300, purchasable: true },
  { id: 'name_gold_shine', category: 'name_style', name: 'Имя «Золотой блеск»', price: 1600, purchasable: true },
  { id: 'skin_scales', category: 'territory_skin', name: 'Скин «Чешуя»', price: 800, purchasable: true },
  { id: 'skin_depth', category: 'territory_skin', name: 'Скин «Глубины»', price: 1000, purchasable: true },
  { id: 'skin_compass', category: 'territory_skin', name: 'Скин «Роза ветров»', price: 1300, purchasable: true },
  { id: 'skin_school', category: 'territory_skin', name: 'Скин «Косяк»', price: 1600, purchasable: true },
]

export function withPremiumPreview(items: ShopItem[]): ShopItem[] {
  if (process.env.NODE_ENV === 'production') return items
  const have = new Set(items.map((i) => i.id))
  const missing = PREMIUM_SHOP_PREVIEW.filter((i) => !have.has(i.id))
  if (missing.length === 0) return items
  // Keep each category's own block together, premium at its end.
  const out = [...items]
  for (const m of missing) {
    let at = -1
    out.forEach((i, idx) => {
      if (i.category === m.category) at = idx
    })
    out.splice(at + 1, 0, m)
  }
  return out
}
