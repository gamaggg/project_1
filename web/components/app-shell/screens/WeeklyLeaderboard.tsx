'use client'

import { SkeletonRows } from '@/components/app-shell/Skeleton'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { thumbUrl } from '@/lib/supabase/imageUrl'
import { useAuth } from '@/components/providers/AuthProvider'
import { useClanBadges, useSecretBox, useWeeklyLeaderboard } from '@/lib/supabase/queries'
import { CoinIcon } from '@/components/app-shell/CoinIcon'
import { ClanCrest } from '@/components/app-shell/ClanCrest'
import { PartnerPrizeCard } from '@/components/app-shell/PartnerPrizeCard'
import type { WeeklyLeaderboardEntry } from '@/lib/data/types'
import { CITIES, type CityId } from '@/lib/data/city'
import { formatWeekLeft, formatWeekOfMonth, pluralCatches, pluralSectors } from '@/lib/format'
import { tn } from '@/lib/i18n'
import { nameInitials } from '@/lib/initials'

type Scope = 'all' | 'friends'

const MEDAL_COLOR: Record<1 | 2 | 3, string> = {
  1: '#F0A93E',
  2: '#B8C0CC',
  3: '#B06B36',
}

function Crown() {
  return (
    <svg className="rating-podium-crown" viewBox="0 0 32 26" fill="none" aria-hidden="true">
      <path d="M4 11L9 15L16 4L23 15L28 11L26 21H6L4 11Z" fill="#F0A93E" stroke="#FFFCF5" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx="9" cy="15" r="1.6" fill="#FFE7BE" />
      <circle cx="16" cy="4" r="1.8" fill="#FFE7BE" />
      <circle cx="23" cy="15" r="1.6" fill="#FFE7BE" />
    </svg>
  )
}

function PodiumAvatar({ entry, rank }: { entry: WeeklyLeaderboardEntry; rank: 1 | 2 | 3 }) {
  const size = rank === 1 ? 88 : 72
  const initials = nameInitials(entry.displayName, 2)
  return (
    <div className="rating-podium-stage">
      {/* Rank 1 gets a floating bob — the shadow lives outside the moving
          wrap so it stays "on the ground" while the avatar rises above it. */}
      {rank === 1 && <div className="rating-podium-shadow" />}
      <div className={`rating-podium-avatar-wrap${rank === 1 ? ' rating-podium-float' : ''}`} style={{ width: size, height: size }}>
        <div className="rating-podium-glow" style={{ background: MEDAL_COLOR[rank] }} />
        {rank === 1 && <Crown />}
        <div className="avatar" style={{ width: size, height: size, fontSize: rank === 1 ? 24 : 19, border: '3px solid var(--surface)', position: 'relative', zIndex: 2 }}>
          {entry.avatarUrl ? <img src={thumbUrl(entry.avatarUrl, 96)} alt="" loading="lazy" decoding="async" /> : initials}
        </div>
        <div className="rating-podium-medal" style={{ background: `linear-gradient(160deg, ${MEDAL_COLOR[rank]}, ${MEDAL_COLOR[rank]}CC)` }}>
          {rank}
        </div>
      </div>
    </div>
  )
}

// enterDelayMs: undefined renders at rest instantly (the live current-week
// podium). Passing a number adds the ceremony pop-in, delayed by that much —
// used by LastWeekScreen to reveal 3rd -> 2nd -> 1st in sequence.
// Left-to-right podium slots with #1 always in the middle: 2–1–3. With two
// finishers the third slot comes back empty (null) instead of being dropped —
// the podium row centers its items as a group, so dropping it centered the
// pair and pushed #1 left of center. Rank numbers stay tied to each entry.
export function podiumSlots<T>(podium: T[]): (T | null)[] {
  if (podium.length < 2) return podium
  return [podium[1], podium[0], podium[2] ?? null]
}

export function PodiumItem({
  entry,
  rank,
  onOpenUser,
  enterDelayMs,
  clanCrest,
  isMe = false,
  prize,
}: {
  entry: WeeklyLeaderboardEntry
  rank: 1 | 2 | 3
  onOpenUser: (id: string) => void
  enterDelayMs?: number
  clanCrest?: unknown
  // The viewer's own place gets a mark.
  isMe?: boolean
  // The week's prize for this place (live week, where the box is open).
  prize?: { coins: number; key?: true; rank: 1 | 2 | 3 }
}) {
  return (
    <button
      className={`rating-podium-item${rank === 1 ? ' rank-1' : ''}${enterDelayMs !== undefined ? ' rating-podium-item-enter' : ''}${isMe ? ' is-me' : ''}`}
      style={enterDelayMs !== undefined ? { animationDelay: `${enterDelayMs}ms` } : undefined}
      onClick={() => onOpenUser(entry.userId)}
    >
      <PodiumAvatar entry={entry} rank={rank} />
      <div className="rating-podium-name">
        {clanCrest != null && <ClanCrest crest={clanCrest} size={16} className="rating-name-crest" />}
        {entry.displayName}
        {isMe && <span className="rating-me-tag">{tn('sector.you')}</span>}
      </div>
      <div className="rating-podium-stat-main">{entry.sectorsThisWeek} {pluralSectors(entry.sectorsThisWeek)}</div>
      <div className="rating-podium-stat-sub">{entry.catchesThisWeek} {pluralCatches(entry.catchesThisWeek)}</div>
      {prize && <PodiumPrize rank={prize.rank} />}
    </button>
  )
}

// The week's own prizes for the top 3 (grant_weekly_rank_awards, 25.11.2026): 300 coins and a key (a free secret box),
// 200, 100 — for a player with at least one sector of the week. Shown on the podium where the box is open.
export const WEEK_PRIZES: { rank: 1 | 2 | 3; coins: number; key?: true }[] = [
  { rank: 1, coins: 300, key: true },
  { rank: 2, coins: 200 },
  { rank: 3, coins: 100 },
]
// A prize under a podium place (or an empty one): the coins, and the key for the first. A tap explains it (owner,
// 25.11.2026) — without opening the player's profile, which the podium place does.
function PodiumPrize({ rank }: { rank: 1 | 2 | 3 }) {
  const [open, setOpen] = useState(false)
  const prize = WEEK_PRIZES[rank - 1]
  return (
    <>
      <span
        role="button"
        tabIndex={0}
        className="rating-podium-prize"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            e.stopPropagation()
            setOpen(true)
          }
        }}
      >
        {prize.coins}
        <CoinIcon size={16} />
        {prize.key && (
          <>
            +{/* eslint-disable-next-line @next/next/no-img-element -- a small icon, the slots' own key */}
            <img src="/slots/key.webp" width={18} height={18} alt={tn('terr.weekPrizeKey')} />
          </>
        )}
      </span>
      {open && <PrizeInfo rank={rank} onClose={() => setOpen(false)} />}
    </>
  )
}

// What a podium prize is (owner: «explain it nicer»): the medal, the prize large, the key's meaning, three short rules
// with icons. The card sits in a portal, but React still bubbles its clicks to the podium button, so every
// click here stops.
function PrizeInfo({ rank, onClose }: { rank: 1 | 2 | 3; onClose: () => void }) {
  const prize = WEEK_PRIZES[rank - 1]
  const close = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    onClose()
  }
  return createPortal(
    <div className="modal-overlay" onClick={close}>
      <div className="modal-card prize-info" role="dialog" aria-label={tn('terr.prizeTitle', { n: rank })} onClick={(e) => e.stopPropagation()}>
        <div className="prize-info-medal" style={{ background: `linear-gradient(160deg, ${MEDAL_COLOR[rank]}, ${MEDAL_COLOR[rank]}CC)` }}>
          {rank}
        </div>
        <div className="modal-title">{tn('terr.prizeTitle', { n: rank })}</div>
        <div className="prize-info-prize">
          <span className="prize-info-coins">
            {prize.coins}
            <CoinIcon size={28} />
          </span>
          {prize.key && (
            <span className="prize-info-key">
              +{/* eslint-disable-next-line @next/next/no-img-element -- the slots' own key */}
              <img src="/slots/key.webp" width={34} height={34} alt="" />
            </span>
          )}
        </div>
        {prize.key && <div className="prize-info-keynote">{tn('terr.prizeKeyNote')}</div>}
        <ul className="prize-info-rules">
          <li>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
              <path d="M7 6H4.5v1.5A3.5 3.5 0 0 0 8 11M17 6h2.5v1.5A3.5 3.5 0 0 1 16 11" />
              <path d="M12 14v3.5M8.5 20.5h7" />
            </svg>
            {tn('terr.prizeRuleTop')}
          </li>
          <li>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="round" aria-hidden>
              <path d="M12 2.8l7.8 4.6v9.2L12 21.2l-7.8-4.6V7.4z" />
            </svg>
            {tn('terr.prizeRuleSector')}
          </li>
          <li>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
            </svg>
            {tn('terr.prizeRuleWhen')}
          </li>
        </ul>
        <button className="btn-primary" onClick={close}>
          {tn('sector.badgeInfo.ok')}
        </button>
      </div>
    </div>,
    document.body
  )
}

// A podium place nobody holds yet (one or two players this week): its prize waits, «Свободно».
export function EmptyPrizePlace({ rank }: { rank: 1 | 2 | 3 }) {
  return (
    <div className={`rating-podium-item rating-podium-empty${rank === 1 ? ' rank-1' : ''}`}>
      <div className="rating-podium-empty-ring" style={{ width: rank === 1 ? 88 : 72, height: rank === 1 ? 88 : 72 }}>
        <div className="rating-podium-medal" style={{ background: `linear-gradient(160deg, ${MEDAL_COLOR[rank]}, ${MEDAL_COLOR[rank]}CC)` }}>
          {rank}
        </div>
      </div>
      <div className="rating-podium-name rating-podium-free">{tn('terr.placeFree')}</div>
      <PodiumPrize rank={rank} />
    </div>
  )
}

export function WeeklyLeaderboard({ city, onOpenUser }: { city: CityId; onOpenUser: (id: string) => void }) {
  const [scope, setScope] = useState<Scope>('all')
  const cityInfo = CITIES[city]
  const { user } = useAuth()
  // Everyone who caught something this week, not only the first ten.
  const { data: entries = [], isLoading } = useWeeklyLeaderboard(scope === 'friends', 0, cityInfo.idPrefix, cityInfo.timezone, 500)
  const { data: badges } = useClanBadges(city, entries.length > 0)

  const podium = entries.slice(0, 3)
  const rest = entries.slice(3)
  const slots = podiumSlots(podium)
  // The week's prizes stand on the podium (25.11.2026) — for the whole city's rating only (among friends the places
  // aren't the prize places), where the box is open; all three places shown, a free one with its prize waiting.
  const { data: box } = useSecretBox()
  const prized = !!box && scope === 'all'
  const prizeSlots = prized ? [podium[1] ?? null, podium[0] ?? null, podium[2] ?? null] : slots
  // Among friends the places are the friends' own, not the prize places: a friend gets the prize of their place in the
  // whole city, and only if they are in its top 3 (the city's list is the same query as «Все», usually cached).
  const { data: cityEntries = [] } = useWeeklyLeaderboard(false, 0, cityInfo.idPrefix, cityInfo.timezone, 500)
  const prizeOf = (userId: string) => {
    if (!box) return undefined
    const cityRank = cityEntries.findIndex((e) => e.userId === userId) + 1
    return cityRank >= 1 && cityRank <= 3 ? { ...WEEK_PRIZES[cityRank - 1], rank: cityRank as 1 | 2 | 3 } : undefined
  }

  return (
    <>
      <div className="filter-row">
        <div className={`filter-chip${scope === 'all' ? ' active' : ''}`} onClick={() => setScope('all')}>
          {tn('terr.filterAll')}
        </div>
        <div className={`filter-chip${scope === 'friends' ? ' active' : ''}`} onClick={() => setScope('friends')}>
          {tn('terr.friends')}
        </div>
        <span className="rating-week-badge rating-week-badge-inline">
          {formatWeekOfMonth(0, cityInfo.timezone)} · {formatWeekLeft(cityInfo.timezone)}
        </span>
      </div>

      <PartnerPrizeCard city={city} week={0} />

      {isLoading ? (
        <SkeletonRows count={6} thumb={40} round />
      ) : entries.length === 0 ? (
        <div style={{ padding: 26, textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5 }}>
          {scope === 'friends' ? tn('terr.emptyFriends') : tn('terr.emptyAll')}
        </div>
      ) : (
        <>
          <div className={`rating-podium${prized ? ' prized' : ''}`}>
            {prizeSlots.map((entry, i) =>
              entry ? (
                <PodiumItem
                  key={entry.userId}
                  entry={entry}
                  rank={entry.rank as 1 | 2 | 3}
                  onOpenUser={onOpenUser}
                  clanCrest={badges?.get(entry.userId)?.crest}
                  isMe={entry.userId === user?.id}
                  prize={prizeOf(entry.userId)}
                />
              ) : prized ? (
                <EmptyPrizePlace key={`free-${i}`} rank={([2, 1, 3] as const)[i]} />
              ) : (
                <div key={`empty-${i}`} className="rating-podium-item" aria-hidden />
              )
            )}
          </div>

          {rest.length > 0 && (
            <div className="card" style={{ overflow: 'hidden' }}>
              {rest.map((entry, i) => {
                const initials = nameInitials(entry.displayName, 2)
                return (
                  <button
                    key={entry.userId}
                    className={`terr-list-item${entry.userId === user?.id ? ' rating-row-me' : ''}`}
                    style={{ borderBottom: i < rest.length - 1 ? '1px solid var(--line)' : 'none' }}
                    onClick={() => onOpenUser(entry.userId)}
                  >
                    <div className="rating-list-rank">{entry.rank}</div>
                    <div className="avatar" style={{ width: 36, height: 36, fontSize: 12.5 }}>
                      {entry.avatarUrl ? <img src={thumbUrl(entry.avatarUrl, 96)} alt="" loading="lazy" decoding="async" /> : initials}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {badges?.get(entry.userId) && <ClanCrest crest={badges.get(entry.userId)!.crest} size={16} />}
                        {entry.displayName}
                        {entry.userId === user?.id && <span className="rating-me-tag">{tn('sector.you')}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--accent)' }}>{entry.sectorsThisWeek} {pluralSectors(entry.sectorsThisWeek)}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 1 }}>{entry.catchesThisWeek} {pluralCatches(entry.catchesThisWeek)}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </>
      )}
    </>
  )
}
