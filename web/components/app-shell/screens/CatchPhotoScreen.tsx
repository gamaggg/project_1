'use client'

import { useEffect, useRef, useState } from 'react'
import { thumbUrl } from '@/lib/supabase/imageUrl'
import { useCatchById, useCatchesByTerritory, useCatchLikes, useToggleCatchLike, useIsSuperAdmin } from '@/lib/supabase/queries'
import { useAuth } from '@/components/providers/AuthProvider'
import { formatCatchMeta, formatWhen } from '@/lib/format'
import { CatcherLabel } from '@/components/app-shell/screens/TerritoryScreen'
import { BackButton } from '@/components/app-shell/BackButton'
import type { ProfileSummary } from '@/lib/data/types'

// "Иван" / "Иван и Мария" / "Иван, Мария и ещё 5" — sidesteps gender-correct
// verb conjugation entirely (no existing activity text in this app bothers
// with it either, see ActivityScreen's fixed masculine forms) by phrasing
// this as a plain label instead of a sentence.
function likersSummary(likers: ProfileSummary[]): string {
  const names = likers.map((l) => l.displayName)
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} и ${names[1]}`
  return `${names[0]}, ${names[1]} и ещё ${names.length - 2}`
}

// A real screen (pushed on the stack, reachable via ?catch=<id>) rather than
// the old bare-overlay lightbox — see FishZoneApp's openCatchPhoto. Replaces
// the flat catch-list row's cramped report/delete buttons with real touch
// targets here instead (see TerritoryScreen.tsx's own comment on why they
// moved). Self-contained like MyCatchesScreen/AchievementDetailScreen — a
// shared link may open straight into this screen with nothing else loaded.
export function CatchPhotoScreen({
  catchId,
  onBack,
  onOpenUser,
  onOpenTerritory,
  onShare,
  onReportPhoto,
  onDeleteCatch,
  onOpenLikers,
}: {
  catchId: number
  onBack: () => void
  onOpenUser: (id: string) => void
  onOpenTerritory: (id: string) => void
  onShare: (catchId: number, text: string) => void
  onReportPhoto: (catchId: number) => void
  onDeleteCatch: (catchId: number) => void
  onOpenLikers: (likers: ProfileSummary[]) => void
}) {
  const { user } = useAuth()
  const isSuperAdmin = useIsSuperAdmin()
  // Paging swaps which catch this screen shows without pushing a new stack
  // entry per swipe (which would make "back" have to click through every
  // catch you passed) — activeId starts at the prop and only diverges once
  // you actually swipe/tap; a fresh catchId from the outside (a new
  // openCatchPhoto/deep-link while this screen is still mounted — Screen
  // never unmounts, see DECISIONS.md) resyncs it.
  const [activeId, setActiveId] = useState(catchId)
  useEffect(() => setActiveId(catchId), [catchId])

  const { data: c } = useCatchById(activeId)
  const { data: likes } = useCatchLikes(activeId)
  const { data: sectorCatches = [] } = useCatchesByTerritory(c?.territoryId ?? null)
  const toggleLike = useToggleCatchLike()
  // Only the tap that ADDS a like plays the pop — matches Twitter/Instagram
  // convention (removing a like is a quiet, neutral action). The mutation
  // is optimistic (see useToggleCatchLike) so this fires on the tap itself,
  // not once the network round-trip resolves.
  const [justLiked, setJustLiked] = useState(false)

  const sectorIndex = sectorCatches.findIndex((sc) => sc.id === activeId)
  const prevCatch = sectorIndex > 0 ? sectorCatches[sectorIndex - 1] : null
  const nextCatch = sectorIndex >= 0 && sectorIndex < sectorCatches.length - 1 ? sectorCatches[sectorIndex + 1] : null

  function goTo(id: number) {
    setActiveId(id)
  }

  // Swipe = a plain horizontal drag past a threshold, measured on release.
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  function handleTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
  }
  function handleTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current
    touchStart.current = null
    if (!start) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return
    if (dx < 0 && nextCatch) goTo(nextCatch.id)
    else if (dx > 0 && prevCatch) goTo(prevCatch.id)
  }

  if (!c) return null
  const meta = formatCatchMeta(c.lengthCm, c.weightKg)
  const likedByMe = likes?.likedByMe ?? false

  function handleToggleLike() {
    if (!user) return
    if (!likedByMe) setJustLiked(true)
    toggleLike.mutate({ catchId: c!.id, liked: likedByMe })
  }

  return (
    // No .header-row — a separate white bar above the photo left dead space
    // at the top. Back/delete float over the photo instead (padding:0 here,
    // restored on the sheet below so the fixed bottom nav still clears it).
    // Touch handlers live on this outer shell (stays mounted across swipes)
    // so the keyed inner wrapper below is free to remount per catch without
    // dropping a gesture mid-swipe.
    <div
      className="screen-inner"
      style={{ padding: 0, display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0 }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Keyed by activeId so the whole catch — photo and sheet together —
          plays one simple fade-in as a unit when paging (see globals.css).
          flex column/flex:1/minHeight:0 repeats the outer shell's own rule
          so the fill-the-remaining-space photo sizing (see below) still
          works one level down. */}
      <div key={activeId} className="catch-fade-in" style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0 }}>
        <div style={{ position: 'relative', flex: '1 1 auto', minHeight: 0 }}>
          {/* A capped ratio (object-fit:cover crops instead of a portrait
              photo's full native height) keeps the photo from pushing the
              action row below the fold — flex:1 above fills exactly the
              space the sheet's own height leaves behind, on any screen
              height. */}
          <img src={c.photoUrl} alt={c.speciesName} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          <div style={{ position: 'absolute', top: 12, left: 12 }}>
            <BackButton onClick={onBack} registerNative={false} />
          </div>
          {isSuperAdmin && (
            <div
              className="icon-btn tap-scale"
              style={{ position: 'absolute', top: 12, right: 12 }}
              onClick={() => onDeleteCatch(c.id)}
              title="Удалить улов"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#D33" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M10 11v6M14 11v6M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
              </svg>
            </div>
          )}
          {prevCatch && (
            <div className="icon-btn tap-scale" style={{ position: 'absolute', top: '50%', left: 12, transform: 'translateY(-50%)' }} onClick={() => goTo(prevCatch.id)} title="Предыдущий улов">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </div>
          )}
          {nextCatch && (
            <div className="icon-btn tap-scale" style={{ position: 'absolute', top: '50%', right: 12, transform: 'translateY(-50%)' }} onClick={() => goTo(nextCatch.id)} title="Следующий улов">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </div>
          )}
          {sectorCatches.length > 1 && sectorIndex >= 0 && (
            <div
              style={{
                position: 'absolute',
                bottom: 30,
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(23,24,27,0.5)',
                color: '#fff',
                fontSize: 11.5,
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: 20,
              }}
            >
              {sectorIndex + 1} / {sectorCatches.length}
            </div>
          )}
        </div>
        {/* A rounded-top sheet pulled up over the photo's bottom edge (common
            photo-detail pattern) reads as a distinct layer of facts/actions
            even though --surface and --bg are the same white — the shadow and
            the photo's own color underneath do the separating. */}
        <div
          style={{
            position: 'relative',
            flex: '0 0 auto',
            marginTop: -18,
            borderRadius: '20px 20px 0 0',
            background: 'var(--surface)',
            boxShadow: '0 -6px 18px rgba(23,24,27,0.07)',
            padding: '18px 20px 100px',
          }}
        >
          {/* Identity + reaction share one row (like reads as a lightweight
              reaction to who/what, not a standalone action), the facts about
              the catch stack right under it, and the two heavier social
              actions (report/share) get their own button row at the bottom —
              grouped by weight instead of one flat strip of controls. */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <CatcherLabel userId={c.userId} mine={c.mine} onOpenUser={onOpenUser} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div
                className={`icon-btn tap-scale${justLiked ? ' like-pop-anim' : ''}`}
                style={{
                  width: 32,
                  height: 32,
                  ...(likedByMe ? { background: 'rgba(211,51,51,0.1)', border: '1px solid rgba(211,51,51,0.3)' } : {}),
                }}
                onClick={handleToggleLike}
                onAnimationEnd={() => setJustLiked(false)}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill={likedByMe ? '#D33' : 'none'} stroke={likedByMe ? '#D33' : '#17181B'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </div>
              <div
                key={likes?.count ?? 0}
                className={justLiked ? 'like-count-pop-anim' : undefined}
                style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-soft)', minWidth: 12, cursor: likes?.count ? 'pointer' : undefined }}
                onClick={() => (likes?.count ? onOpenLikers(likes.likers) : undefined)}
              >
                {likes?.count ?? 0}
              </div>
            </div>
          </div>

          {/* Tapping either this or the count above opens PeopleListModal —
              the Instagram "liked by" sheet, with search and a follow button
              per row (see FishZoneApp's viewingLikersFor). */}
          {!!likes?.likers.length && (
            <div className="tap-scale" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, cursor: 'pointer' }} onClick={() => onOpenLikers(likes.likers)}>
              <div style={{ display: 'flex' }}>
                {likes.likers.slice(0, 3).map((l, i) => (
                  <div
                    key={l.userId}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      overflow: 'hidden',
                      background: 'var(--ink)',
                      color: '#fff',
                      fontSize: 10,
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 0 0 2px var(--surface)',
                      marginLeft: i === 0 ? 0 : -8,
                      flex: '0 0 auto',
                    }}
                  >
                    {l.avatarUrl ? <img src={thumbUrl(l.avatarUrl, 96)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" decoding="async" /> : l.displayName.slice(0, 1).toUpperCase()}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>Нравится: {likersSummary(likes.likers)}</div>
            </div>
          )}

          <div style={{ fontWeight: 800, fontSize: 20, marginTop: likes?.likers.length ? 12 : 4 }}>{c.speciesName}</div>
          {meta && <div style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginTop: 2 }}>{meta}</div>}
          <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <button className="section-link" style={{ fontSize: 12.5 }} onClick={() => onOpenTerritory(c.territoryId)}>
              Сектор {c.territoryId}
            </button>
            <span>· {formatWhen(c.caughtAt)}</span>
          </div>

          <div style={{ height: 1, background: 'var(--line)', margin: '16px 0' }} />

          <div style={{ display: 'flex', gap: 10 }}>
            {user && !c.mine && (
              <button className="btn-secondary" style={{ flex: 1, padding: '9px 14px', fontSize: 13 }} onClick={() => onReportPhoto(c.id)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 3v18M5 4h12l-2.5 4L17 12H5" />
                </svg>
                Пожаловаться
              </button>
            )}
            <button
              className="btn-secondary"
              style={{ flex: 1, padding: '9px 14px', fontSize: 13 }}
              onClick={() => onShare(c.id, `🎣 ${c.speciesName} в RANGE`)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 15V4M12 4 8 8M12 4l4 4" />
                <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
              </svg>
              Поделиться
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
