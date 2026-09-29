import type { Database } from '@/lib/types'
import type { SpeciesCategory } from '@/lib/data/species'
import type { CityId } from '@/lib/data/city'

export type TerritoryKind = Database['public']['Enums']['territory_kind']
export type TerritoryStatus = 'mine' | 'other' | 'free'

// Geometry (id/kind/lat/lng/corners) comes from public/data/sectors.json — static,
// never changes at runtime. Ownership (status/ownerId/catchCount/lastCatchAt) comes
// from Supabase (territories_with_stats) and is merged onto it by id. See DOCS.md.
export type Territory = {
  id: string
  kind: TerritoryKind
  lat: number
  lng: number
  corners: [number, number][]
  status: TerritoryStatus
  ownerId: string | null
  ownerAvatarUrl: string | null
  ownerDisplayName: string | null
  catchCount: number
  lastCatchAt: string | null
  // Set by the Щит/Прилив buffs — null or in the past means unprotected.
  // Public: a deterrent other players need to see, not just the owner.
  shieldUntil: string | null
  // The owner's equipped territory_skin item (see lib/data/territorySkins.ts)
  // — public, drives the sector's fill pattern on the map for everyone, not
  // just the owner.
  ownerEquippedSkin: string | null
  // The owner's current clan (see territories_with_stats) — drives the map's
  // «Кланы» layer and the sector screen's clan line.
  ownerClanId: number | null
  ownerClanName: string | null
  ownerClanCrest: unknown
  // Clan-mates sharing the sector with its owner (territory_shares, oldest
  // first, at most 3) — a clan-mate's catch joins the share instead of
  // taking the sector. Empty for an unshared sector. The map and the sector
  // screen split the hex into one equal part per holder (owner first).
  coHolders: TerritoryCoHolder[]
}

export type TerritoryCoHolder = {
  id: string
  avatarUrl: string | null
  displayName: string | null
  // The viewer's own share — painted in their territory colour, like
  // status 'mine' is for a sector they own.
  isMe: boolean
}

export type Species = {
  key: string
  name: string
  category: SpeciesCategory
}

// From profiles_with_stats (view) — followers/following are real aggregates,
// not the old static placeholder column. See DECISIONS.md.
export type Profile = {
  id: string
  displayName: string
  location: string | null
  avatarUrl: string | null
  bio: string | null
  isAdmin: boolean
  isSuperAdmin: boolean
  isBlocked: boolean
  publicId: string
  followersCount: number
  followingCount: number
  // birthDate/gender/heightCm/weightKg are masked to non-owners at the view
  // level (profiles_with_stats) — always null when viewing someone else's
  // profile, regardless of whether they actually set them.
  birthDate: string | null
  gender: 'male' | 'female' | null
  heightCm: number | null
  weightKg: number | null
  // null until the onboarding wizard's color step runs (or for pre-wizard
  // accounts) — read sites fall back to DEFAULT_TERRITORY_COLOR.
  territoryColor: string | null
  // Preset id for the profile hero panel's background (see heroBackgrounds.ts
  // and ChangeColorModal) — null until the owner picks one, read sites fall
  // back to DEFAULT_HERO_BG. Unmasked in profiles_with_stats: everyone who
  // opens this profile sees the owner's chosen background, not just them.
  heroBg: string | null
  onboardingCompleted: boolean
  createdAt: string
  // Which city this account plays in — a real per-profile column (not just
  // the viewer's own localStorage lens, see lib/data/city), set at onboarding's
  // CityStep and changeable later from Профиль. Used to compute achievements
  // for THIS profile under its owner's own city, not the viewer's.
  city: CityId
  // Granular admin permissions (see AdminPermissionsModal) — masked to null
  // for anyone but the profile's own owner, same as birthDate/gender/etc
  // above. A super admin editing someone else's permissions reads the real,
  // unmasked values via useAdminPermissions() (get_admin_permissions RPC)
  // instead of these fields.
  canModerateReports: boolean | null
  canBlockUsers: boolean | null
  canAddCatchManually: boolean | null
  canViewAllUsers: boolean | null
  canAddCatchFromGallery: boolean | null
  // Owned avatar frame (see lib/data/shopItems.ts), shown to every viewer
  // like heroBg — null means no frame equipped.
  equippedFrame: string | null
  // Wallet balance — masked to non-owners at the view level, same reasoning
  // as birthDate/gender/etc above. Always null on someone else's profile,
  // except for a super admin viewing it (see profiles_with_stats).
  coins: number | null
  // Owned name_style item (see lib/data/nameStyles.ts) — public, like
  // equippedFrame/heroBg, shown wherever this profile's display name renders.
  equippedNameStyle: string | null
  // Owned territory_skin item (see lib/data/territorySkins.ts) — public,
  // applied to every sector this profile owns (see Territory.ownerEquippedSkin).
  equippedSkin: string | null
  // Current clan, public (see profiles_with_stats) — null when not in one.
  // clanCrest is the raw jsonb, read through resolveCrest()/ClanCrest.
  clanId: number | null
  clanName: string | null
  clanCrest: unknown
  clanRole: 'leader' | 'co_leader' | 'elder' | 'member' | null
}

// The real, unmasked permission set for one admin — only a super admin can
// fetch this (get_admin_permissions RPC), for any user id, not just their
// own. Drives AdminPermissionsModal's toggles.
export type AdminPermissions = {
  isAdmin: boolean
  canModerateReports: boolean
  canBlockUsers: boolean
  canAddCatchManually: boolean
  canViewAllUsers: boolean
  canAddCatchFromGallery: boolean
}

// One row from profiles_with_stats for the admin "Все пользователи" list —
// shaped in queries.ts (useAllUsers), not the full Profile (no need for the
// self-only masked fields there).
export type UserListEntry = {
  id: string
  displayName: string
  avatarUrl: string | null
  publicId: string
  createdAt: string
  catchesCount: number
  territoriesCount: number
}

// One row from get_weekly_leaderboard(), shaped in queries.ts
// (useWeeklyLeaderboard). Ranked by sectors first-claimed this Batumi week
// (Mon 00:00 – Sun 23:59), catches this week as the tiebreaker/secondary
// stat — see DECISIONS.md.
export type WeeklyLeaderboardEntry = {
  userId: string
  displayName: string
  avatarUrl: string | null
  sectorsThisWeek: number
  catchesThisWeek: number
  rank: number
}

// A collectible medal a user has earned (see user_awards, AwardsRing) — public
// on any profile, distinct from Achievement (progress-grid, self-computed).
// kind drives the icon/color (see awardIcons.tsx); title/subtitle/description
// are plain text set when the award was granted, not recomputed client-side.
export type AwardKind = 'weekly_rank' | 'guardian' | 'catch_of_month' | 'lightning' | 'season_legend' | 'night_watch' | 'duelist' | 'clan_race_winner'
export type UserAward = {
  id: number
  kind: AwardKind
  title: string
  subtitle: string
  description: string
  earnedAt: string
}

export type Catch = {
  id: number
  territoryId: string
  userId: string
  species: string
  speciesName: string
  speciesCategory: SpeciesCategory
  lengthCm: number | null
  weightKg: number | null
  method: string | null
  bait: string | null
  photoUrl: string
  caughtAt: string
  mine: boolean
}

// A minimal person reference for list-of-people UI — useCatchLikes' likers
// (CatchPhotoScreen's facepile) and useFollowers' followers (ProfileScreen/
// UserProfileScreen's "Подписчики" list) share this exact shape, both
// rendered by the same PeopleListModal.
export type ProfileSummary = {
  userId: string
  displayName: string
  avatarUrl: string | null
}

// One row from catch_reports, joined with what an admin needs to act on it —
// shaped in queries.ts (useReports), not a raw DB row.
export type CatchReport = {
  id: number
  catchId: number
  reason: string
  createdAt: string
  reporterId: string
  reporterName: string
  territoryId: string
  photoUrl: string
  speciesName: string | null
}

// One row from admin_actions, joined with the admin's display name — shaped
// in queries.ts (useAdminActions), used for "Последние действия".
export type AdminAction = {
  id: number
  adminName: string
  details: string
  createdAt: string
  targetUserId: string | null
  targetUserName: string | null
  territoryId: string | null
}

// A profile currently holding admin access (is_admin && !is_super_admin),
// with when it was granted — a live view, not a log entry, so a revoked
// admin simply drops out of this list rather than leaving a "revoked" row.
export type AdminListEntry = {
  id: string
  displayName: string
  grantedAt: string | null
}

export type PendingCatch = {
  territoryId: string
  species: string
  lengthCm: number | null
  weightKg: number | null
  method: string | null
  bait: string | null
  photoUrl: string
}

// id is a string, not the raw activity_log bigint — 'follow' entries are
// synthesized client-side from the `follows` table (see useActivity in
// queries.ts), so ids need a namespaced format (`log:123` / `follow:<uid>`)
// to guarantee no collision between the two sources. territoryId/territoryKind
// are absent on 'follow' entries (a subscription isn't tied to any sector).
export type ActivityEntry = {
  id: string
  who: string
  userId: string
  avatarUrl: string | null
  // "This concerns a sector of mine" — the feed only carries other people's
  // actions now, so this no longer means "I did it" (see useActivity).
  mine: boolean
  kind: 'catch' | 'sector_lost' | 'follow' | 'moderation' | 'like' | 'announcement' | 'award' | 'weekly_result' | 'challenge' | 'challenges_week_done' | 'challenge_deadline' | 'comment' | 'comment_reply' | 'comment_removed' | 'clan_invite' | 'clan_join_request' | 'clan_join_accepted' | 'clan_role_changed' | 'clan_kicked' | 'clan_disbanded' | 'clan_chest_reward' | 'clan_race_result' | 'clan_race_overtaken' | 'clan_race_finished' | 'clan_chat_mention' | 'referral_joined' | 'referral_reward' | 'system_alert'
  // Still unread as of the moment the screen loaded. Opening the feed marks
  // everything read, so this is a snapshot, not live state.
  unread: boolean
  territoryId?: string
  territoryKind?: TerritoryKind
  speciesName: string | null
  speciesCategory: SpeciesCategory | null
  lengthCm: number | null
  weightKg: number | null
  photoUrl: string | null
  catchId: number | null
  createdAt: string
  // City feed rows (useCityFeed): a catch by anyone in the player's city,
  // not a notification — never unread. claimed: that catch took the sector.
  fromCity?: boolean
  claimed?: boolean
  // 'announcement' only — a super admin's broadcast post, shown to every
  // user in their feed (see useActivity/admin_post_announcement). Null for
  // every other kind.
  body: string | null
  // 'announcement' only — an optional CTA button under the text (both null,
  // or both set together — see admin_post_announcement's check).
  buttonLabel: string | null
  buttonUrl: string | null
  // 'comment' / 'comment_reply' — a clipped copy of the comment (see
  // post_comment's payload) and its id, for opening the thread on it.
  commentText: string | null
  commentId: number | null
  // clan_* kinds — copied into the payload at send time (see _clan_notify),
  // so the feed can show the crest without another lookup.
  clanId: number | null
  clanName: string | null
  clanCrest: unknown
  clanRole: string | null
  // clan_chest_reward / clan_race_* — the week's numbers from the payload
  // (see settle_clan_week and clan_race_tick).
  clanWeek: { tier: number | null; coins: number | null; place: number | null; finished: boolean; ahead: string | null; trophies: number | null } | null
  // 'system_alert' only — super admins' «something is broken» text (see
  // system_health_tick).
  alertText: string | null
  // 'award' only — copied straight from user_awards at grant time (see
  // fanout_award_notification), so the feed never needs to join it back.
  awardTitle: string | null
  awardSubtitle: string | null
  // 'award' only — the coin payout for this award/achievement, when the
  // grant carried one (fanout_award_notification and
  // _sync_achievements_for_user both include it in the payload).
  awardCoins: number | null
  // 'weekly_result' only — this person's own place in last week's
  // leaderboard, computed once by notify_weekly_results.
  weeklyRank: number | null
  weeklySectors: number | null
  weeklyCatches: number | null
  // 'challenge' only — which one just got settled, copied at grant time same
  // as awardTitle (see sync_my_challenges). Null for 'challenges_week_done',
  // since that one isn't about a single challenge.
  challengeTitle: string | null
  // 'challenge' and 'challenges_week_done' both carry this — the payout for
  // that one challenge, or the whole week's total once every slot is done.
  challengeCoins: number | null
  // 'challenge_deadline' only — how many hours were left when this fired
  // (see notify_challenge_deadline_approaching's cron schedule).
  challengeHours: number | null
  // 'moderation' only — set when the removed catch had already paid out
  // coins, so admin_delete_catch clawed them back (see that function). Both
  // null for a moderated catch that never earned anything in the first
  // place (e.g. an unrecognized species).
  moderationSpecies: string | null
  moderationCoinsRemoved: number | null
}

// One row of a catch's comment thread (see get_catch_comments). parentId is
// always the thread's root — replies never nest deeper than one level; who a
// reply answers is replyToUserId/replyToName instead. A deleted root still
// comes back (body null, deleted true) while it has live replies, so the
// thread keeps its anchor.
export type CatchComment = {
  id: number
  parentId: number | null
  userId: string
  displayName: string
  avatarUrl: string | null
  nameStyle: string | null
  replyToUserId: string | null
  replyToName: string | null
  body: string | null
  createdAt: string
  deleted: boolean
  mine: boolean
  clanCrest: unknown
  clanName: string | null
  // Local-only: an optimistic row still waiting on post_comment.
  pending?: boolean
}

// Clans — see DECISIONS.md «Кланы» and the clans_core migration. Crests are
// the raw jsonb, always read through resolveCrest()/ClanCrest.
export type ClanRoleId = 'leader' | 'co_leader' | 'elder' | 'member'

export type ClanSummary = {
  id: number
  name: string
  motto: string | null
  crest: unknown
  background: string
  level: number
  trophies: number
  members: number
  capacity: number
  joinType: 'open' | 'request' | 'invite'
  minSectors: number
  sectorsHeld: number
}

export type ClanMember = {
  userId: string
  displayName: string
  avatarUrl: string | null
  nameStyle: string | null
  role: ClanRoleId
  joinedAt: string
  weekCatches: number
  sectors: number
}

export type ClanJoinRequest = { userId: string; displayName: string; avatarUrl: string | null; sectors: number; createdAt: string }

export type ClanEvent = {
  kind: string
  actorName: string | null
  targetName: string | null
  payload: Record<string, unknown> | null
  createdAt: string
}

// One message of a clan's chat (get_clan_chat). role is the author's
// current role in the clan — null once they've left it.
export type ClanChatMessage = {
  id: number
  userId: string | null
  displayName: string
  avatarUrl: string | null
  nameStyle: string | null
  role: ClanRoleId | null
  body: string
  createdAt: string
  mine: boolean
  // Optimistic copy while post_clan_message is in flight.
  pending?: boolean
}

// The chat card on the clan screen and the profile's clan card.
export type ClanChatSummary = {
  unread: number
  last: { id: number; body: string; createdAt: string; author: string; mine: boolean } | null
}

export type ClanDetail = {
  id: number
  city: 'batumi' | 'moscow'
  name: string
  motto: string | null
  // Members only — null for everyone else (see get_clan).
  announcement: string | null
  crest: unknown
  background: string
  joinType: 'open' | 'request' | 'invite'
  minSectors: number
  xp: number
  level: number
  capacity: number
  // Bonus member slots a super admin granted on top of the level's own;
  // undefined until the server sends it (older database).
  extraSlots?: number
  trophies: number
  createdAt: string
  renamedAt: string | null
  disbanded: boolean
  myRole: ClanRoleId | null
  myRequestPending: boolean
  myInvite: boolean
  // Regatta wins over all time, and whether last week's was one of them
  // (see settle_clan_week's race_won).
  raceWins: number
  wonLastWeek: boolean
  sectorsHeld: number
  members: ClanMember[]
  // Elder and up only — null for everyone else.
  requests: ClanJoinRequest[] | null
  events: ClanEvent[]
}

export type ClanEligibility = {
  sectors: number
  sectorsNeeded: number
  coins: number
  price: number
  inClan: boolean
  cooldownUntil: string | null
}

export type ClanInvite = { clanId: number; name: string; crest: unknown; invitedByName: string | null; createdAt: string }

export type ClanChest = {
  weekStart: string
  weekEnd: string
  points: number
  tier: number
  thresholds: number[]
  rewards: number[]
  contributors: { userId: string; displayName: string; avatarUrl: string | null; points: number }[]
  lastWeek: { tier: number; points: number } | null
}

export type ClanRaceEntry = {
  id: number
  name: string
  crest: unknown
  meters: number
  finish: number
  finishedAt: string | null
  members: number
  rank: number
}

export type ClanRace = {
  weekStart: string
  weekEnd: string
  myClanId: number | null
  myToday: number
  dailyCap: number
  // This week's meters per rower of the viewer's own clan (daily cap applied).
  myRowers: { userId: string; displayName: string; avatarUrl: string | null; meters: number }[]
  clans: ClanRaceEntry[]
  lastWeek: { id: number; name: string; crest: unknown; place: number; finished: boolean; meters: number; finish: number }[]
}
