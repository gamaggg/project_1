'use client'

import { useEffect, useRef, useState } from 'react'
import { useActivity, useMarkNotificationsRead } from '@/lib/supabase/queries'
import { CATEGORY_GRADIENT, KIND_LABEL } from '@/lib/data/species'
import { formatCatchMeta, formatWhen, pluralSectors, pluralCatches } from '@/lib/format'
import { FishIcon } from '@/components/app-shell/icons'
import { CoinIcon } from '@/components/app-shell/CoinIcon'
import { thumbUrl } from '@/lib/supabase/imageUrl'

type Filter = 'all' | 'mine'

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
  onOpenUser,
  onOpenTerritory,
  onOpenPhoto,
  onOpenRating,
  onOpenOwnAwards,
  onOpenLastWeek,
  onOpenChallenges,
}: {
  // This screen stays mounted while other tabs are on top of it, so being
  // rendered says nothing about being looked at — and marking notifications
  // read is exactly the kind of thing that must only happen when it is.
  active: boolean
  onOpenUser: (id: string) => void
  onOpenTerritory: (id: string) => void
  onOpenPhoto: (catchId: number) => void
  onOpenRating: () => void
  onOpenOwnAwards: () => void
  onOpenLastWeek: () => void
  onOpenChallenges: () => void
}) {
  const { data: activity = [], isLoading, isSuccess } = useActivity()
  const markRead = useMarkNotificationsRead()
  const [filter, setFilter] = useState<Filter>('all')
  // Opening the screen is what marks things read, but the dots have to stay
  // visible for this visit or "what's new" would vanish before it could be
  // read — hence a snapshot taken once per visit, rather than rendering live
  // state.
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set())
  const [snapshotTaken, setSnapshotTaken] = useState(false)
  // Every screen in this shell stays mounted for the app's whole lifetime
  // (see the `active` prop note above), so without this, "once" above would
  // really mean once ever — leave the tab and come back and the dots from
  // the very first visit would still be sitting there, never re-snapshotted,
  // however many times you actually revisit.
  const wasActiveRef = useRef(active)
  useEffect(() => {
    if (active && !wasActiveRef.current) setSnapshotTaken(false)
    wasActiveRef.current = active
  }, [active])

  useEffect(() => {
    if (!active || !isSuccess || snapshotTaken) return
    setSnapshotTaken(true)
    const unread = activity.filter((a) => a.unread).map((a) => a.id)
    setUnreadIds(new Set(unread))
    if (unread.length) markRead.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, isSuccess, snapshotTaken])

  const list = activity.filter((a) => (filter === 'mine' ? a.mine : true))
  // Announcements are global, so the feed is never literally empty — without
  // this, someone who has never had a single notification would still fall
  // past the empty state and just see RANGE's own posts with no idea what
  // this screen is for.
  const hasPersonal = activity.some((a) => a.kind !== 'announcement')

  return (
    <div className="screen-inner">
      <div className="page-title">Активность</div>
      <div className="page-sub">Что происходит на побережье</div>
      <div className="filter-row">
        <div className={`filter-chip${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>
          Все
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
              Здесь появятся уловы рыбаков, на которых ты подписан, и всё, что происходит с твоими секторами.
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
          list.map((a) => {
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
                  <div className="avatar" style={{ background: '#D33' }}>!</div>
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
            if (a.kind === 'award') {
              return (
                <div className="activity-item tap-scale" key={a.id} style={{ cursor: 'pointer' }} onClick={onOpenOwnAwards}>
                  <div className="avatar" style={{ background: 'var(--accent)' }}>🏆</div>
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
                  <div className="avatar" style={{ background: 'var(--accent)', padding: 5 }}>
                    <img
                      src="/brand/logo_2.svg"
                      alt="RANGE"
                      style={{ width: '100%', height: 'auto', objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
                    />
                  </div>
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
                  <div className="avatar" style={{ background: 'var(--accent)', padding: 5 }}>
                    <img
                      src="/brand/logo_2.svg"
                      alt="RANGE"
                      style={{ width: '100%', height: 'auto', objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
                    />
                  </div>
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
                  <div className="avatar" style={{ background: 'var(--accent)', padding: 5 }}>
                    <img
                      src="/brand/logo_2.svg"
                      alt="RANGE"
                      style={{ width: '100%', height: 'auto', objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
                    />
                  </div>
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
                  <div className="avatar" style={{ background: 'var(--blue)' }}>📊</div>
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
                    : `поймал ${a.speciesName?.toLowerCase() ?? 'рыбу'}`
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
                  {meta && (
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
                    onClick={() => a.catchId && onOpenPhoto(a.catchId)}
                  >
                    {a.photoUrl ? <img src={thumbUrl(a.photoUrl, 160)} alt={a.speciesName} loading="lazy" decoding="async" /> : <FishIcon size={18} />}
                  </div>
                )}
              </div>
            )
          })
        ) : (
          <div style={{ padding: '26px 22px', textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5, lineHeight: 1.5 }}>
            {filter === 'mine' ? 'Твои сектора никто не трогал' : 'Пока нет активности'}
          </div>
        )}
      </div>
    </div>
  )
}
