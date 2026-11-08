import type { SubTab } from '@/components/clan2/ClanScreen2'
import type { TKey } from '@/lib/i18n/core'

// The «Что нового» tours of the clan update: one for players, one for the admin.
// A step lights one element (data-tour="…") on a screen of the preview and says
// one thing about it. The real app's tours (lib/data/tours.ts) get the same
// steps when the update ships.

export type TourTab = 'map' | 'clan' | 'profile' | 'admin'
// sub: the sandbox's section, or — in the real app's tour — the clan screen's tab (treasury, shop, hq, members, chest…).
export type TourStep = { target: string | null; tab: TourTab; sub?: SubTab | string; text: TKey }
export type TourAudience = 'player' | 'admin'

export const PLAYER_TOUR: TourStep[] = [
  { target: 'treasury-balance', tab: 'clan', sub: 'treasury', text: 'clan2.tour.p1' },
  { target: 'treasury-sources', tab: 'clan', sub: 'treasury', text: 'clan2.tour.p2' },
  { target: 'treasury-tax', tab: 'clan', sub: 'treasury', text: 'clan2.tour.p3' },
  { target: 'exit-card', tab: 'clan', sub: 'exit', text: 'clan2.tour.p4' },
  { target: 'map-layer', tab: 'map', text: 'clan2.tour.p5' },
  { target: 'map-bell', tab: 'map', text: 'clan2.tour.p6' },
  { target: 'week-quest', tab: 'clan', sub: 'week', text: 'clan2.tour.p7' },
]

// The real app (08.11.2026): the clan screen's tabs in order, one block each, the map last (in words: the tour stays
// on the clan screen). Started once by itself, again from «Как это работает» → «Пройти тур».
export const LIVE_TOUR: TourStep[] = [
  { target: 'treasury-balance', tab: 'clan', sub: 'treasury', text: 'clan2.ltour.balance' },
  { target: 'treasury-sources', tab: 'clan', sub: 'treasury', text: 'clan2.ltour.sources' },
  { target: 'treasury-journal', tab: 'clan', sub: 'treasury', text: 'clan2.ltour.journal' },
  { target: 'shop-top', tab: 'clan', sub: 'shop', text: 'clan2.ltour.shop' },
  { target: 'hq-card', tab: 'clan', sub: 'hq', text: 'clan2.ltour.hq' },
  { target: 'hq-buildings', tab: 'clan', sub: 'hq', text: 'clan2.ltour.base' },
  { target: 'hq-rules', tab: 'clan', sub: 'hq', text: 'clan2.ltour.defend' },
  { target: 'exit-card', tab: 'clan', sub: 'exit', text: 'clan2.ltour.exit' },
  { target: 'week-quest', tab: 'clan', sub: 'week', text: 'clan2.ltour.week' },
  { target: 'members-list', tab: 'clan', sub: 'members', text: 'clan2.ltour.members' },
  { target: 'chest-treasury', tab: 'clan', sub: 'chest', text: 'clan2.ltour.chest' },
  { target: null, tab: 'clan', sub: 'treasury', text: 'clan2.ltour.map' },
]

export const ADMIN_TOUR: TourStep[] = [
  { target: 'admin-switch', tab: 'admin', text: 'clan2.tour.a1' },
  { target: 'admin-settings', tab: 'admin', text: 'clan2.tour.a2' },
  { target: 'admin-economy', tab: 'admin', text: 'clan2.tour.a3' },
  { target: 'admin-journal', tab: 'admin', text: 'clan2.tour.a4' },
]
