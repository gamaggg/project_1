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
  // The member's own picture (live mode); none — the coloured circle with initials.
  avatarUrl?: string | null
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
  | 'looted'
  | 'seed'
  | 'quest'
  | 'tournament'
  | 'spend_buff'
  | 'spend_goal'
  | 'spend_project'
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
  kind: 'clan_skin' | 'boat' | 'frame'
  cost: number
  // The clan level that opens it.
  minLevel: number
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
  // When the defence of the HQ sector last changed (it wears down 1 per «Крепость»-days without clan catches).
  defenseAt: number | null
  // After a fall: the ruins of the old HQ, what the attackers carried off and until when a new one cannot be built.
  ruins: { sectorId: string; by: string; loot: number; fellAt: number; until: number } | null
  // After a fall the first new HQ is free, once in the clan's life (owner, 13.11.2026): true while it is still due.
  freeRebuild?: boolean
  // The browser-only preview: the free rebuild was spent.
  freeRebuildUsed?: boolean
}

export type AlertKind = 'sector_attack' | 'hq_siege' | 'hq_saved' | 'hq_fallen' | 'buff' | 'nudge' | 'quest_done' | 'project_done' | 'recruit'
export type ClanAlert = { id: number; at: number; kind: AlertKind; text: string; sectorId?: string; read: boolean }

export type QuestKind = 'catches' | 'species' | 'rare' | 'big' | 'length' | 'members' | 'days' | 'sectors'
export type WeeklyQuest = {
  kind: QuestKind
  target: number
  progress: number
  reward: number
  endsAt: number
  claimed: boolean
  // «big»: the length in cm the fish must pass.
  param?: number
  // Live mode: how much of the progress the real catches of the clan give, and how much the test bench added.
  real?: number
  sim: number
  // Who collected the reward and when; the members who caught for it this week.
  claimedBy?: string | null
  claimedAt?: number | null
  helpers?: string[]
}

export type ProjectId = 'dock' | 'beacon' | 'fort' | 'board' | 'storage' | 'market'
export type ProjectLevel = 0 | 1 | 2 | 3

// photo: the catch's own photo (live mode, from catches.photo_url), shown in the hall of fame instead of a drawing.
export type HallRecord = { species: string; member: string; cm: number | null; kg: number | null; at: number; hue: number; photo?: string | null; avatarUrl?: string | null; catchId?: number }

export type RecruitEntry = { name: string; state: 'invited' | 'joined' | 'caught' | 'paid'; daysLeft: number }

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
  speedupShare: number
}

export type ClanInfo = {
  name: string
  // The clan's city (live mode: the real one); the shop tries a sector skin on this city's map.
  city?: import('@/lib/data/city').CityId
  motto: string
  crest: { shape: string; symbol: string; primary: string; secondary: string }
  background: string
  level: number
  xp: number
  trophies: number
}

// Set when the state is built from the player's real clan (see lib/clan2/live/seed.ts): who, which clan,
// and what role the demo shows (null — the real one).
export type LiveMeta = {
  clanId: number
  userId: string
  realRole: ClanRole
  viewAs: ClanRole | null
  isSuperAdmin: boolean
}

export type DemoState = {
  live?: LiveMeta
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
  // The building under construction (one at a time): what, to which level, when it is ready.
  build: { id: ProjectId; toLevel: 1 | 2 | 3; startedAt: number; endsAt: number } | null
  // What the clan has bought: the ids of the shop's items (skin_wave, boat_gold, frame_gold…).
  owned: string[]
  // The sector skin the clan's sectors wear, and the boat and the frame in use (item ids).
  equippedSkin: string | null
  equipped: { boat: string | null; frame: string | null }
  // What every member put into the treasury this month (deposits and the catch tax), by member id; it starts again
  // on the 1st.
  deposits: { month: number; byMember: Record<string, number> }
  hall: HallRecord[]
  recruit: RecruitEntry[]
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
  // The server's id of the current «Выход» (live mode on the server: «иду» is said to it).
  buffId?: number | null
}
