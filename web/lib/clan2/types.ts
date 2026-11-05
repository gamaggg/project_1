// The clan update («Общак»): the data model the new clan screens work on. The
// same shapes serve the demo store (lib/clan2/demoStore.ts, fictional data
// kept in localStorage — what /clan-preview runs on) and the live API
// (lib/clan2/api.ts, the RPCs of web/supabase-drafts/clan-update-06-11/).

export type Persona = 'leader' | 'member' | 'solo' | 'admin'
export type ClanRole = 'leader' | 'co_leader' | 'elder' | 'member'

export type DemoMember = {
  id: string
  name: string
  role: ClanRole
  // Avatar colour, 0–359.
  hue: number
  // What the member put into the treasury this week: deposits and the catch tax.
  weekDeposit: number
  weekMeters: number
  // Minutes since the last catch; null — none this week.
  lastCatchMin: number | null
  online: boolean
}

export type TreasuryKind =
  | 'rent'
  | 'hot_rent'
  | 'tax'
  | 'deposit'
  | 'chest_share'
  | 'race_share'
  | 'recruit'
  | 'refund'
  | 'quest'
  | 'tournament'
  | 'spend_buff'
  | 'spend_goal'
  | 'spend_project'
  | 'spend_bounty'
  | 'spend_hq'
  | 'spend_skin'

export type TreasuryEntry = {
  id: number
  at: number
  kind: TreasuryKind
  // + comes in, − goes out.
  amount: number
  // Member id; null — the game itself (rent, shares).
  actor: string | null
  note: string
}

export type GoalItem = {
  id: string
  kind: 'clan_skin' | 'boat' | 'banner' | 'project'
  cost: number
}

export type BuffPhase = 'idle' | 'planned' | 'active' | 'cooldown'
export type BuffState = {
  phase: BuffPhase
  startsAt: number | null
  endsAt: number | null
  cooldownUntil: number | null
  rsvp: string[]
  startedBy: string | null
  // What the last «Выход» brought, for the card afterwards.
  lastBonus: number
}

export type HqState = {
  sectorId: string | null
  placedAt: number | null
  lastMoveAt: number | null
  siege: { by: string; startedAt: number; endsAt: number } | null
}

export type AlertKind = 'sector_attack' | 'hq_siege' | 'hq_saved' | 'hq_fallen' | 'buff' | 'nudge' | 'quest_done' | 'bounty' | 'project_done' | 'recruit'
export type ClanAlert = { id: number; at: number; kind: AlertKind; text: string; sectorId?: string; read: boolean }

export type QuestKind = 'catches' | 'species' | 'capture' | 'rare'
export type WeeklyQuest = { kind: QuestKind; target: number; progress: number; reward: number; endsAt: number; claimed: boolean }

export type ProjectId = 'dock' | 'beacon' | 'board' | 'storage'
export type ProjectLevel = 0 | 1 | 2 | 3

export type BountyKind = 'species' | 'size' | 'sector'
export type Bounty = {
  id: number
  kind: BountyKind
  species?: string
  minCm?: number
  sectorId?: string
  reward: number
  createdBy: string
  claimedBy: string | null
  expiresAt: number
}

export type TournamentState = {
  species: string
  endsAt: number
  standings: { clan: string; score: number; mine?: boolean }[]
}

export type HallRecord = { species: string; member: string; cm: number; kg: number; at: number; hue: number }

export type SeasonState = { n: number; startedAt: number; endsAt: number; trophies: number }

export type RecruitEntry = { name: string; state: 'invited' | 'joined' | 'caught' | 'paid'; daysLeft: number }

export type PartnerOffer = { id: string; shop: string; titleKey: string; cost: number; owned: boolean }

export type SectorOwner = 'mine' | 'ally' | 'enemy' | 'free'
export type MapSector = {
  id: string
  // Axial hex coordinates on the preview map.
  q: number
  r: number
  owner: SectorOwner
  defense: number
  shield: boolean
  hot: boolean
  // How many clan-mates share it (1 — one holder).
  shared: number
  // Which clan skin paints it (only a sector of the clan that bought it).
  skin: string | null
  hq: 'mine' | 'enemy' | null
}

export type EconomySettings = {
  enabled: boolean
  rentPerSectorDay: number
  sharedRentFactor: number
  buffPrice: number
  buffCooldownHours: number
  buffMinRsvp: number
  taxMax: number
  chestShare: number
  recruitReward: number
  hqPlaceCost: number
  hqMoveCost: number
}

export type ClanInfo = {
  name: string
  motto: string
  crest: { shape: string; symbol: string; primary: string; secondary: string }
  background: string
  level: number
  xp: number
  trophies: number
}

export type DemoState = {
  // Added to Date.now() — the «ускорить время» button of the demo panel.
  clockOffsetMs: number
  persona: Persona
  myId: string
  // The player's own coins (what the personal Kazna used to feed).
  wallet: number
  clan: ClanInfo
  members: DemoMember[]
  treasury: { balance: number; taxRate: number; entries: TreasuryEntry[]; goalId: string | null }
  buff: BuffState
  hq: HqState
  alerts: ClanAlert[]
  quest: WeeklyQuest
  projects: Record<ProjectId, ProjectLevel>
  // What the clan has bought: clan skins (clan_*), the golden boat, the banner.
  owned: string[]
  equippedSkin: string | null
  bounties: Bounty[]
  tournament: TournamentState
  hall: HallRecord[]
  season: SeasonState
  recruit: RecruitEntry[]
  offers: PartnerOffer[]
  sectors: MapSector[]
  settings: EconomySettings
  // Which «Что нового» tour each audience has seen.
  toursSeen: { player: boolean; admin: boolean }
  // The species caught this week, for the «разные виды» quest.
  questSeen: string[]
  // When the rent was last paid into the treasury (it comes in whole days).
  lastRentAt: number
  // When each member was last called to the water (once a day per member).
  nudgedAt: Record<string, number>
  // The next id for entries, alerts and bounties.
  seq: number
}
