'use client'

import { useEffect, useMemo, useState } from 'react'
import { useActivity, useCityFeed, useMarkNotificationsRead } from '@/lib/supabase/queries'
import type { CityId } from '@/lib/data/city'
import type { ActivityEntry } from '@/lib/data/types'
import { CATEGORY_GRADIENT, KIND_LABEL } from '@/lib/data/species'
import { formatCatchMeta, formatWhen, pluralSectors, pluralCatches } from '@/lib/format'
import { FishIcon } from '@/components/app-shell/icons'
import { CoinIcon } from '@/components/app-shell/CoinIcon'
import { AwardFeedIcon, FeedIcon, FEED_ICONS } from '@/components/app-shell/ActivityIcons'
import { useT } from '@/lib/i18n'
import { thumbUrl } from '@/lib/supabase/imageUrl'
import { ClanCrest } from '@/components/app-shell/ClanCrest'
import { CLAN_ROLE_LABEL, type ClanRole } from '@/lib/data/clanLevels'

// «Все» — your own notifications plus every fisher's catches in your city;
// «Друзья» — catches by people you follow; «Мои территории» — your sectors.
type Filter = 'all' | 'friends' | 'mine'

// A run of one fisher's catches on one sector — consecutive in the feed,
// each under SERIES_GAP_MS from the next — shows as a single line instead of
// a wall of near-identical rows (one active angler used to fill a screen).
type CatchSeries = { seriesId: string; items: ActivityEntry[] }
const SERIES_GAP_MS = 3 * 60 * 60_000

function groupSeries(list: ActivityEntry[]): (ActivityEntry | CatchSeries)[] {
  const out: (ActivityEntry | CatchSeries)[] = []
  let run: ActivityEntry[] = []
  const flush = () => {
    if (run.length >= 2) out.push({ seriesId: `series:${run[0].id}`, items: run })
    else out.push(...run)
    run = []
  }
  for (const a of list) {
    const prev = run[run.length - 1]
    const joins =
      !!prev &&
      a.kind === 'catch' &&
      prev.userId === a.userId &&
      prev.territoryId === a.territoryId &&
      new Date(prev.createdAt).getTime() - new Date(a.createdAt).getTime() < SERIES_GAP_MS
    if (joins) {
      run.push(a)
      continue
    }
    flush()
    if (a.kind === 'catch' && a.territoryId) run = [a]
    else out.push(a)
  }
  flush()
  return out
}

function pluralFish(n: number): string {
  const d = n % 10
  const dd = n % 100
  if (d === 1 && dd !== 11) return `${n} рыбу`
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return `${n} рыбы`
  return `${n} рыб`
}

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

function CatchSeriesRow({
  series,
  unread,
  expanded,
  onToggle,
  onOpenUser,
  onOpenTerritory,
  onOpenPhoto,
}: {
  series: CatchSeries
  unread: boolean
  expanded: boolean
  onToggle: () => void
  onOpenUser: (id: string) => void
  onOpenTerritory: (id: string) => void
  onOpenPhoto: (catchId: number) => void
}) {
  const newest = series.items[0]
  const oldest = series.items[series.items.length - 1]
  const n = series.items.length
  const claimed = series.items.some((i) => i.claimed)
  const counts = new Map<string, number>()
  for (const i of series.items) {
    const name = (i.speciesName ?? 'рыба').toLowerCase()
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  const species = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, c]) => (c > 1 ? `${name} ×${c}` : name))
    .join(' · ')
  // "Сегодня · 08:30–10:06" when the run fits in one day, else just when it ended.
  const newestWhen = formatWhen(newest.createdAt)
  const sameDay = new Date(newest.createdAt).toDateString() === new Date(oldest.createdAt).toDateString()
  const when = sameDay && newestWhen.includes(' · ') ? `${newestWhen.split(' · ')[0]} · ${clock(oldest.createdAt)}–${clock(newest.createdAt)}` : newestWhen

  return (
    <div className="activity-item activity-series">
      <div className="avatar" style={{ background: 'var(--blue)' }}>
        {newest.avatarUrl ? <img src={thumbUrl(newest.avatarUrl, 96)} alt="" loading="lazy" decoding="async" /> : newest.who.slice(0, 1)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.35 }}>
          <button className="activity-who-btn" onClick={() => onOpenUser(newest.userId)}>
            {newest.who}
          </button>{' '}
          поймал {pluralFish(n)}
          {claimed ? ' и захватил сектор' : ''}
        </div>
        {newest.territoryId && (
          <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2 }}>
            <button className="activity-who-btn" onClick={() => onOpenTerritory(newest.territoryId!)}>
              Территория {newest.territoryId}
            </button>
            {newest.territoryKind ? ` · ${KIND_LABEL[newest.territoryKind]}` : ''}
          </div>
        )}
        <div className="activity-series-species">{species}</div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {unread && <span className="unread-dot" />}
          {when}
          <button className="activity-series-toggle" onClick={onToggle} aria-expanded={expanded}>
            {expanded ? 'Свернуть' : `Показать все ${n}`}
          </button>
        </div>
        {expanded && (
          <div className="activity-series-list">
            {series.items.map((i) => {
              const meta = formatCatchMeta(i.lengthCm, i.weightKg)
              return (
                <button key={i.id} className="activity-series-catch tap-scale" onClick={() => i.catchId && onOpenPhoto(i.catchId)}>
                  <span className="fish-thumb" style={{ width: 36, height: 36, borderRadius: 10, background: i.photoUrl ? undefined : CATEGORY_GRADIENT[i.speciesCategory ?? 'marine'] }}>
                    {i.photoUrl ? <img src={thumbUrl(i.photoUrl, 96)} alt="" loading="lazy" decoding="async" /> : <FishIcon size={14} />}
                  </span>
                  <span className="activity-series-catch-text">
                    <b>{i.speciesName ?? 'Рыба'}</b>
                    {meta ? ` · ${meta}` : ''}
                    {i.claimed ? ' · захват' : ''}
                  </span>
                  <span className="activity-series-catch-time">{clock(i.createdAt)}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
      <button className="activity-series-thumbs" onClick={() => newest.catchId && onOpenPhoto(newest.catchId)} aria-label="Открыть последний улов">
        {series.items.slice(0, 3).map((t, idx) => (
          <span
            key={t.id}
            className="fish-thumb"
            style={{ left: idx * 10, zIndex: 3 - idx, background: t.photoUrl ? undefined : CATEGORY_GRADIENT[t.speciesCategory ?? 'marine'] }}
          >
            {t.photoUrl ? <img src={thumbUrl(t.photoUrl, 160)} alt="" loading="lazy" decoding="async" /> : <FishIcon size={16} />}
          </span>
        ))}
      </button>
    </div>
  )
}

// Splitting on a capturing group keeps the URLs themselves in the result
// array at the odd indices (a plain JS quirk of String.split with a
// capturing regex) — cheaper and more reliable than re-testing a stateful
// global regex per part.
function linkifyBody(text: string) {
  return text.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
    i % 2 === 1 ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="announcement-link">
        {part}
      </a>
    ) : (
      part
    )
  )
}

export function ActivityScreen({
  active,
  city,
  onOpenUser,
  onOpenTerritory,
  onOpenPhoto,
  onOpenClan,
  onOpenRating,
  onOpenOwnAwards,
  onOpenLastWeek,
  onOpenChallenges,
  onOpenRace,
  onOpenClanChat,
  onOpenShop,
  onOpenMap,
}: {
  // This screen stays mounted while other tabs are on top of it, so being
  // rendered says nothing about being looked at — and marking notifications
  // read is exactly the kind of thing that must only happen when it is.
  active: boolean
  // Whose catches fill the «Все» tab — the player's city.
  city: CityId
  onOpenUser: (id: string) => void
  onOpenTerritory: (id: string) => void
  onOpenPhoto: (catchId: number, commentId?: number | null) => void
  onOpenClan: (id: number) => void
  onOpenRating: () => void
  onOpenOwnAwards: () => void
  onOpenLastWeek: () => void
  onOpenChallenges: () => void
  onOpenRace: () => void
  onOpenClanChat: (clanId: number) => void
  onOpenShop?: () => void
  onOpenMap?: () => void
}) {
  const tr = useT()
  const { data: activity = [], isLoading, isSuccess } = useActivity()
  const { data: cityFeed = [] } = useCityFeed(city)
  const markRead = useMarkNotificationsRead()
  const [filter, setFilter] = useState<Filter>('all')
  // Opening the screen is what marks things read, but the dots have to stay
  // visible for this visit or "what's new" would vanish before it could be
  // read — hence a snapshot taken once per visit, rather than rendering live
  // state.
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set())
  const [snapshotTaken, setSnapshotTaken] = useState(false)
  // Bumped whenever something unread was just shown — the effect below
  // marks it read on the server once per bump.
  const [markRound, setMarkRound] = useState(0)
  // Every screen in this shell stays mounted for the app's whole lifetime
  // (see the `active` prop note above), so without this, "once" above would
  // really mean once ever — leave the tab and come back and the dots from
  // the very first visit would still be sitting there, never re-snapshotted,
  // however many times you actually revisit.
  // Adjusted during render rather than in effects: a new visit resets the
  // snapshot, and the snapshot is taken in the same pass the feed becomes
  // visible — no frame with stale dots in between. `needsSnapshot` carries
  // the reset into this same pass (the state itself only updates next pass).
  const [prevActive, setPrevActive] = useState(active)
  let needsSnapshot = !snapshotTaken
  if (active !== prevActive) {
    setPrevActive(active)
    if (active) {
      setSnapshotTaken(false)
      needsSnapshot = true
    }
  }
  if (active && isSuccess) {
    if (needsSnapshot) {
      const unread = activity.filter((a) => a.unread).map((a) => a.id)
      setSnapshotTaken(true)
      setUnreadIds(new Set(unread))
      if (unread.length) setMarkRound((r) => r + 1)
    } else {
      // Arrived while the screen is open (realtime): it gets its dot and is
      // marked read too, or the tab badge would keep counting it.
      const fresh = activity.filter((a) => a.unread && !unreadIds.has(a.id)).map((a) => a.id)
      if (fresh.length) {
        setUnreadIds(new Set([...unreadIds, ...fresh]))
        setMarkRound((r) => r + 1)
      }
    }
  }
  // Marking read talks to the server, so that part stays an effect. Keyed on
  // the round, not on a "done" flag: an earlier version kept such a flag in a
  // ref that the render-phase reset never cleared, so only the first visit of
  // a session ever marked anything read and the tab badge stuck.
  useEffect(() => {
    if (markRound) markRead.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per round; markRead is a new object every render
  }, [markRound])

  const list = useMemo(() => {
    if (filter === 'mine') return activity.filter((a) => a.mine)
    // follow_catch notifications — the only 'catch' kind in the personal feed.
    if (filter === 'friends') return activity.filter((a) => a.kind === 'catch')
    // A catch that's already a notification (a friend's catch, the one that
    // took your sector) shows once, as the notification — it can be unread.
    const known = new Set(activity.map((a) => a.catchId).filter((id): id is number => id !== null))
    return [...activity, ...cityFeed.filter((c) => !known.has(c.catchId!))].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  }, [filter, activity, cityFeed])
  const display = useMemo(() => groupSeries(list), [list])
  const [expandedSeries, setExpandedSeries] = useState<Set<string>>(() => new Set())
  // Announcements are global, so the feed is never literally empty — without
  // this, someone who has never had a single notification would still fall
  // past the empty state and just see RANGE's own posts with no idea what
  // this screen is for.
  const hasPersonal = activity.some((a) => a.kind !== 'announcement') || cityFeed.length > 0

  return (
    <div className="screen-inner">
      <div className="page-title">Активность</div>
      <div className="page-sub">Что происходит на побережье</div>
      <div className="filter-row">
        <div className={`filter-chip${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>
          Все
        </div>
        <div className={`filter-chip${filter === 'friends' ? ' active' : ''}`} onClick={() => setFilter('friends')}>
          Друзья
        </div>
        <div className={`filter-chip${filter === 'mine' ? ' active' : ''}`} onClick={() => setFilter('mine')}>
          Мои территории
        </div>
      </div>
      <div>
        {!isLoading && !hasPersonal && filter === 'all' && (
          <div style={{ padding: '22px 20px 26px', textAlign: 'center' }}>
            <div style={{ fontSize: 14.5, fontWeight: 800 }}>Пока тихо</div>
            <div style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginTop: 8, lineHeight: 1.5 }}>
              Здесь появятся уловы рыбаков твоего города и всё, что происходит с твоими секторами.
            </div>
            <button
              className="btn-secondary tap-scale"
              style={{ width: 'auto', display: 'inline-flex', padding: '10px 20px', fontSize: 13.5, marginTop: 16 }}
              onClick={onOpenRating}
            >
              Найти рыбаков в рейтинге
            </button>
          </div>
        )}
        {isLoading ? (
          <div style={{ padding: 26, textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5 }}>Загрузка…</div>
        ) : list.length ? (
          display.map((a) => {
            if ('items' in a) {
              return (
                <CatchSeriesRow
                  key={a.seriesId}
                  series={a}
                  unread={a.items.some((i) => unreadIds.has(i.id))}
                  expanded={expandedSeries.has(a.seriesId)}
                  onToggle={() =>
                    setExpandedSeries((prev) => {
                      const next = new Set(prev)
                      if (next.has(a.seriesId)) next.delete(a.seriesId)
                      else next.add(a.seriesId)
                      return next
                    })
                  }
                  onOpenUser={onOpenUser}
                  onOpenTerritory={onOpenTerritory}
                  onOpenPhoto={(id) => onOpenPhoto(id)}
                />
              )
            }
            if (a.kind === 'announcement') {
              return (
                <div className="activity-item" key={a.id}>
                  <div className="avatar" style={{ background: 'var(--accent)', padding: 5 }}>
                    {/* logo_2.svg's own fill is brand-orange — forced white here
                        via filter (brightness(0) turns any opaque shape solid
                        black, invert(1) flips that to white) instead of a
                        second export, since it now sits on the orange chip. */}
                    <img
                      src="/brand/logo_2.svg"
                      alt="RANGE"
                      style={{ width: '100%', height: 'auto', objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 800 }}>RANGE</div>
                    <div style={{ fontSize: 13.5, color: 'var(--ink)', marginTop: 4, lineHeight: 1.45, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                      {linkifyBody(a.body ?? '')}
                    </div>
                    {a.buttonLabel && a.buttonUrl && (
                      <a
                        href={a.buttonUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary tap-scale"
                        style={{ width: 'auto', display: 'inline-flex', padding: '9px 18px', fontSize: 13, marginTop: 10 }}
                      >
                        {a.buttonLabel}
                      </a>
                    )}
                    <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {unreadIds.has(a.id) && <span className="unread-dot" />}
                      {formatWhen(a.createdAt)}
                    </div>
                  </div>
                </div>
              )
            }
            if (a.kind === 'moderation') {
              return (
                <div className="activity-item" key={a.id}>
                  <FeedIcon tone="red" icon={FEED_ICONS.shield} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.35 }}>
                      Улов{a.moderationSpecies ? ` (${a.moderationSpecies})` : ''} на территории{' '}
                      <button className="activity-who-btn" onClick={() => onOpenTerritory(a.territoryId!)}>
                        {a.territoryId}
                      </button>{' '}
                      удалён модератором
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2 }}>
                      Нарушены правила площадки. При повторных нарушениях аккаунт будет заблокирован.
                    </div>
                    {a.moderationCoinsRemoved != null && a.moderationCoinsRemoved > 0 && (
                      <div style={{ fontSize: 12.5, color: '#D33', marginTop: 4, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                        Списано {a.moderationCoinsRemoved} <CoinIcon size={16} />
                      </div>
                    )}
                    <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {unreadIds.has(a.id) && <span className="unread-dot" />}
                      {formatWhen(a.createdAt)}
                    </div>
                  </div>
                </div>
              )
            }
            if (a.kind === 'game_event' && a.gameEvent) {
              const ev = a.gameEvent
              const p = ev.payload
              const n = (k: string) => Number(p[k] ?? 0)
              let tone: 'accent' | 'gold' | 'blue' | 'green' = 'accent'
              let icon = FEED_ICONS.flame
              let title = ''
              let sub: string | null = null
              let action: (() => void) | undefined
              if (ev.kind === 'hot_sector_week') {
                const sectors = (p.sectors as string[] | undefined) ?? []
                title = tr('activity.hotWeek', { sectors: sectors.join(', ') })
                sub = tr('activity.hotWeekSub')
                if (sectors[0]) action = () => onOpenTerritory(sectors[0])
              } else if (ev.kind === 'hot_sector_won') {
                title = tr('activity.hotWon', { id: a.territoryId ?? '' })
                sub = tr('activity.hotWonSub', { coins: n('coins') || 100 })
                action = onOpenOwnAwards
              } else if (ev.kind === 'legend_gained' || ev.kind === 'legend_lost') {
                tone = 'gold'
                icon = FEED_ICONS.laurel
                title =
                  ev.kind === 'legend_gained'
                    ? tr('activity.legendGained', { id: a.territoryId ?? '' })
                    : tr('activity.legendLost', { name: a.who || tr('activity.someone'), id: a.territoryId ?? '' })
                sub = ev.kind === 'legend_gained' ? tr('legend.catchesPeriod', { count: n('catches') }) : tr('activity.legendLostSub')
                if (a.territoryId) action = () => onOpenTerritory(a.territoryId!)
              } else if (ev.kind === 'bite_forecast') {
                tone = 'blue'
                icon = FEED_ICONS.bars
                title = n('score') >= 5 ? tr('activity.forecastGreat', { score: n('score') }) : tr('activity.forecastGood', { score: n('score') })
                sub = p.from && p.to ? tr('activity.forecastSub', { from: String(p.from), to: String(p.to) }) : null
                action = onOpenMap
              } else if (ev.kind === 'daily_reward_reminder') {
                tone = 'green'
                icon = FEED_ICONS.gift
                title = tr('activity.reward', { day: n('day') })
                sub = tr('activity.rewardSub', { coins: n('coins') })
                action = onOpenShop
              }
              return (
                <div className={`activity-item${action ? ' tap-scale' : ''}`} key={a.id} style={{ cursor: action ? 'pointer' : undefined }} onClick={action}>
                  <FeedIcon tone={tone} icon={icon} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 800, lineHeight: 1.35 }}>{title}</div>
                    {sub && <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', fontWeight: 600, marginTop: 3 }}>{sub}</div>}
                    <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {unreadIds.has(a.id) && <span className="unread-dot" />}
                      {formatWhen(a.createdAt)}
                    </div>
                  </div>
                </div>
              )
            }
            if (a.kind === 'system_alert') {
              return (
                <div className="activity-item" key={a.id}>
                  <FeedIcon tone="red" icon={FEED_ICONS.alert} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 800, lineHeight: 1.35, color: '#B42318' }}>Тревога: что-то сломалось у игроков</div>
                    <div style={{ fontSize: 13, color: 'var(--ink)', marginTop: 4, lineHeight: 1.45, overflowWrap: 'anywhere' }}>{a.alertText}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {unreadIds.has(a.id) && <span className="unread-dot" />}
                      {formatWhen(a.createdAt)}
                    </div>
                  </div>
                </div>
              )
            }
            if (a.kind === 'clan_chest_reward' || a.kind.startsWith('clan_race_')) {
              const clanName = `«${a.clanName ?? 'клан'}»`
              const w = a.clanWeek
              const isRace = a.kind !== 'clan_chest_reward'
              const title =
                a.kind === 'clan_chest_reward'
                  ? `Сундук ${['I', 'II', 'III', 'IV', 'V'][(w?.tier ?? 1) - 1] ?? ''} клана ${clanName} открыт`
                  : a.kind === 'clan_race_result'
                    ? w?.finished
                      ? `Битва кланов: клан ${clanName} доплыл, ${w?.place ?? '—'}‑е место`
                      : `Битва кланов окончена: у клана ${clanName} ${w?.place ?? '—'}‑е место`
                    : a.kind === 'clan_race_overtaken'
                      ? `Клан ${clanName} обогнали в битве кланов — теперь ${w?.place ?? '—'}‑е место`
                      : `Лодка клана ${clanName} доплыла до финиша!`
              const sub =
                a.kind === 'clan_race_overtaken'
                  ? w?.ahead
                    ? `Впереди «${w.ahead}». Налегайте на вёсла!`
                    : 'Налегайте на вёсла!'
                  : a.kind === 'clan_race_finished'
                    ? 'Итоги и награды — в ночь на понедельник'
                    : a.kind === 'clan_race_result' && w?.trophies
                      ? `Клану +${w.trophies} трофеев`
                      : null
              return (
                <div className="activity-item tap-scale" key={a.id} style={{ cursor: 'pointer' }} onClick={() => (isRace ? onOpenRace() : a.clanId && onOpenClan(a.clanId))}>
                  <div style={{ flex: '0 0 auto' }}>
                    <ClanCrest crest={a.clanCrest} size={44} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.35 }}>{title}</div>
                    {sub && <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2 }}>{sub}</div>}
                    {!!w?.coins && (
                      <div style={{ fontSize: 12.5, color: 'var(--ink)', marginTop: 4, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4 }}>
                        +{w.coins} <CoinIcon size={16} />
                      </div>
                    )}
                    <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {unreadIds.has(a.id) && <span className="unread-dot" />}
                      {formatWhen(a.createdAt)}
                    </div>
                  </div>
                </div>
              )
            }
            if (a.kind === 'referral_joined' || a.kind === 'referral_reward') {
              return (
                <div
                  className={`activity-item${a.kind === 'referral_reward' && a.catchId ? ' tap-scale' : ''}`}
                  key={a.id}
                  style={{ cursor: a.kind === 'referral_reward' && a.catchId ? 'pointer' : undefined }}
                  onClick={() => a.kind === 'referral_reward' && a.catchId && onOpenPhoto(a.catchId)}
                >
                  <FeedIcon tone="accent" icon={FEED_ICONS.medal} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.35 }}>
                      <button
                        className="activity-who-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          onOpenUser(a.userId)
                        }}
                      >
                        {a.who}
                      </button>{' '}
                      {a.kind === 'referral_joined' ? 'зарегистрировался по твоей ссылке' : 'сделал первый улов по твоему приглашению'}
                    </div>
                    <div style={{ fontSize: 12.5, color: a.kind === 'referral_reward' ? 'var(--accent)' : 'var(--ink-soft)', fontWeight: 700, marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                      {a.kind === 'referral_reward' ? (
                        <>
                          +100 <CoinIcon size={16} /> за приглашение
                        </>
                      ) : (
                        'Первый улов друга принесёт тебе 100 монет'
                      )}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {unreadIds.has(a.id) && <span className="unread-dot" />}
                      {formatWhen(a.createdAt)}
                    </div>
                  </div>
                </div>
              )
            }
            if (a.kind === 'clan_chat_mention') {
              return (
                <div className="activity-item tap-scale" key={a.id} style={{ cursor: 'pointer' }} onClick={() => a.clanId && onOpenClanChat(a.clanId)}>
                  <div style={{ flex: '0 0 auto' }}>
                    <ClanCrest crest={a.clanCrest} size={44} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.35 }}>
                      <button
                        className="activity-who-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          onOpenUser(a.userId)
                        }}
                      >
                        {a.who}
                      </button>{' '}
                      упомянул тебя в чате клана «{a.clanName ?? 'клан'}»
                    </div>
                    {a.commentText && <div className="activity-comment-quote">«{a.commentText}»</div>}
                    <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {unreadIds.has(a.id) && <span className="unread-dot" />}
                      {formatWhen(a.createdAt)}
                    </div>
                  </div>
                </div>
              )
            }
            if (a.kind.startsWith('clan_')) {
              const clanName = `«${a.clanName ?? 'клан'}»`
              const text =
                a.kind === 'clan_invite'
                  ? <><button className="activity-who-btn" onClick={() => onOpenUser(a.userId)}>{a.who}</button> зовёт тебя в клан {clanName}</>
                  : a.kind === 'clan_join_request'
                    ? <><button className="activity-who-btn" onClick={() => onOpenUser(a.userId)}>{a.who}</button> хочет вступить в {clanName}</>
                    : a.kind === 'clan_join_accepted'
                      ? <>Тебя приняли в клан {clanName}</>
                      : a.kind === 'clan_role_changed'
                        ? <>Твоя роль в клане {clanName}: {CLAN_ROLE_LABEL[(a.clanRole as ClanRole) ?? 'member']?.toLowerCase()}</>
                        : a.kind === 'clan_disbanded'
                          ? <>Клан {clanName} распущен модератором</>
                          : <>Тебя исключили из клана {clanName}</>
              return (
                <div
                  className="activity-item tap-scale"
                  key={a.id}
                  style={{ cursor: a.clanId && a.kind !== 'clan_kicked' && a.kind !== 'clan_disbanded' ? 'pointer' : undefined }}
                  onClick={() => a.clanId && a.kind !== 'clan_kicked' && a.kind !== 'clan_disbanded' && onOpenClan(a.clanId)}
                >
                  <div style={{ flex: '0 0 auto' }}>
                    <ClanCrest crest={a.clanCrest} size={44} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.35 }}>{text}</div>
                    {a.kind === 'clan_invite' && <div style={{ fontSize: 12.5, color: 'var(--accent)', fontWeight: 700, marginTop: 3 }}>Открыть и принять</div>}
                    {a.kind === 'clan_join_request' && <div style={{ fontSize: 12.5, color: 'var(--accent)', fontWeight: 700, marginTop: 3 }}>Рассмотреть заявку</div>}
                    <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {unreadIds.has(a.id) && <span className="unread-dot" />}
                      {formatWhen(a.createdAt)}
                    </div>
                  </div>
                </div>
              )
            }
            if (a.kind === 'comment_removed') {
              return (
                <div className="activity-item" key={a.id}>
                  <FeedIcon tone="red" icon={FEED_ICONS.shield} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.35 }}>Твой комментарий удалён модератором</div>
                    <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2 }}>
                      Нарушены правила площадки. При повторных нарушениях комментарии будут недоступны.
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {unreadIds.has(a.id) && <span className="unread-dot" />}
                      {formatWhen(a.createdAt)}
                    </div>
                  </div>
                </div>
              )
            }
            if (a.kind === 'award') {
              return (
                <div className="activity-item tap-scale" key={a.id} style={{ cursor: 'pointer' }} onClick={onOpenOwnAwards}>
                  <AwardFeedIcon title={a.awardTitle} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.35 }}>Новая награда: {a.awardTitle}</div>
                    {a.awardSubtitle && <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2 }}>{a.awardSubtitle}</div>}
                    {a.awardCoins != null && <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2 }}>+{a.awardCoins} монет</div>}
                    <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {unreadIds.has(a.id) && <span className="unread-dot" />}
                      {formatWhen(a.createdAt)}
                    </div>
                  </div>
                </div>
              )
            }
            if (a.kind === 'challenge') {
              return (
                <div className="activity-item tap-scale" key={a.id} style={{ cursor: 'pointer' }} onClick={onOpenChallenges}>
                  <FeedIcon tone="accent" icon={FEED_ICONS.target} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.35 }}>Выполнен челлендж: {a.challengeTitle}</div>
                    {a.challengeCoins != null && <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2 }}>+{a.challengeCoins} монет</div>}
                    <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {unreadIds.has(a.id) && <span className="unread-dot" />}
                      {formatWhen(a.createdAt)}
                    </div>
                  </div>
                </div>
              )
            }
            if (a.kind === 'challenges_week_done') {
              return (
                <div className="activity-item tap-scale" key={a.id} style={{ cursor: 'pointer' }} onClick={onOpenChallenges}>
                  <FeedIcon tone="accent" icon={FEED_ICONS.targetDone} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.35 }}>Все челленджи недели выполнены!</div>
                    {a.challengeCoins != null && <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2 }}>+{a.challengeCoins} монет за неделю</div>}
                    <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {unreadIds.has(a.id) && <span className="unread-dot" />}
                      {formatWhen(a.createdAt)}
                    </div>
                  </div>
                </div>
              )
            }
            if (a.kind === 'challenge_deadline') {
              return (
                <div className="activity-item tap-scale" key={a.id} style={{ cursor: 'pointer' }} onClick={onOpenChallenges}>
                  <FeedIcon tone="accent" icon={FEED_ICONS.clock} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.35 }}>Челленджи недели закончатся через {a.challengeHours ?? 48} часов</div>
                    <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2 }}>Не всё ещё выполнено — успей забрать монеты, пока неделя не закрылась</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {unreadIds.has(a.id) && <span className="unread-dot" />}
                      {formatWhen(a.createdAt)}
                    </div>
                  </div>
                </div>
              )
            }
            if (a.kind === 'weekly_result') {
              return (
                <div className="activity-item tap-scale" key={a.id} style={{ cursor: 'pointer' }} onClick={onOpenLastWeek}>
                  <FeedIcon tone="blue" icon={FEED_ICONS.podium} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.35 }}>
                      Итоги недели: {a.weeklyRank} место
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2 }}>
                      {a.weeklySectors} {pluralSectors(a.weeklySectors ?? 0)} · {a.weeklyCatches} {pluralCatches(a.weeklyCatches ?? 0)}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {unreadIds.has(a.id) && <span className="unread-dot" />}
                      {formatWhen(a.createdAt)}
                    </div>
                  </div>
                </div>
              )
            }
            const meta = formatCatchMeta(a.lengthCm, a.weightKg)
            const text =
              a.kind === 'sector_lost'
                ? `забрал твою территорию ${a.territoryId}`
                : a.kind === 'follow'
                  ? 'подписался на тебя'
                  : a.kind === 'like'
                    ? 'лайкнул твой улов'
                    : a.kind === 'comment'
                      ? 'прокомментировал твой улов'
                      : a.kind === 'comment_reply'
                        ? 'ответил на твой комментарий'
                        : `поймал ${a.speciesName?.toLowerCase() ?? 'рыбу'}${a.claimed ? ' и захватил сектор' : ''}`
            const isComment = a.kind === 'comment' || a.kind === 'comment_reply'
            return (
              <div className="activity-item" key={a.id}>
                {/* Every entry is somebody else's doing now, so the name is
                    always a way through to their profile. */}
                <div className="avatar" style={{ background: a.kind === 'sector_lost' ? 'var(--accent)' : 'var(--blue)' }}>
                  {a.avatarUrl ? <img src={thumbUrl(a.avatarUrl, 96)} alt="" loading="lazy" decoding="async" /> : a.who.slice(0, 1)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.35 }}>
                    <button className="activity-who-btn" onClick={() => onOpenUser(a.userId)}>
                      {a.who}
                    </button>{' '}
                    {text}
                  </div>
                  {a.territoryId && a.territoryKind && (
                    <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2 }}>
                      <button className="activity-who-btn" onClick={() => onOpenTerritory(a.territoryId!)}>
                        Территория {a.territoryId}
                      </button>{' '}
                      · {KIND_LABEL[a.territoryKind]}
                    </div>
                  )}
                  {isComment && a.commentText && (
                    <button className="activity-comment-quote tap-scale" onClick={() => a.catchId && onOpenPhoto(a.catchId, a.commentId)}>
                      «{a.commentText}»
                    </button>
                  )}
                  {meta && !isComment && (
                    <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 2, fontWeight: 600 }}>{meta}</div>
                  )}
                  <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {unreadIds.has(a.id) && <span className="unread-dot" />}
                    {formatWhen(a.createdAt)}
                  </div>
                </div>
                {a.speciesName && (
                  <div
                    className="fish-thumb"
                    style={{ width: 44, height: 44, cursor: a.catchId ? 'pointer' : undefined, background: a.photoUrl ? undefined : CATEGORY_GRADIENT[a.speciesCategory ?? 'marine'] }}
                    onClick={() => a.catchId && onOpenPhoto(a.catchId, isComment ? a.commentId : null)}
                  >
                    {a.photoUrl ? <img src={thumbUrl(a.photoUrl, 160)} alt={a.speciesName} loading="lazy" decoding="async" /> : <FishIcon size={18} />}
                  </div>
                )}
              </div>
            )
          })
        ) : (
          <div style={{ padding: '26px 22px', textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5, lineHeight: 1.5 }}>
            {filter === 'mine' ? (
              'Твои сектора никто не трогал'
            ) : filter === 'friends' ? (
              <>
                Здесь появятся уловы рыбаков, на которых ты подписан.
                <br />
                <button
                  className="btn-secondary tap-scale"
                  style={{ width: 'auto', display: 'inline-flex', padding: '10px 20px', fontSize: 13.5, marginTop: 14 }}
                  onClick={onOpenRating}
                >
                  Найти рыбаков в рейтинге
                </button>
              </>
            ) : (
              'Пока нет активности'
            )}
          </div>
        )}
      </div>
    </div>
  )
}
