'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { thumbUrl } from '@/lib/supabase/imageUrl'
import { useCatchById, useCatchesByTerritory, useCatchLikes, useToggleCatchLike, useIsSuperAdmin, useCatchComments, useProfile, useIsFollowing, useSetFollowing } from '@/lib/supabase/queries'
import { useAuth } from '@/components/providers/AuthProvider'
import { formatCatchMeta, formatWhen } from '@/lib/format'
import { CatchConditions } from '@/components/app-shell/CatchConditions'
import { StoryButton } from '@/components/app-shell/StoryButton'
import { BackButton } from '@/components/app-shell/BackButton'
import { PhotoViewer } from '@/components/app-shell/PhotoViewer'
import { EditMyCatchSheet } from '@/components/app-shell/EditMyCatchSheet'
import { EditCatchSheet, MoveCatchSheet } from '@/components/app-shell/lazyScreens'
import type { ProfileSummary } from '@/lib/data/types'
import { tn } from '@/lib/i18n'

// "Иван" / "Иван и Мария" / "Иван, Мария и ещё 5" — sidesteps gender-correct
// verb conjugation entirely (no existing activity text in this app bothers
// with it either, see ActivityScreen's fixed masculine forms) by phrasing
// this as a plain label instead of a sentence.
function likersSummary(likers: ProfileSummary[]): string {
  const names = likers.map((l) => l.displayName)
  if (names.length === 1) return names[0]
  if (names.length === 2) return tn('catch.likersTwo', { a: names[0], b: names[1] })
  return tn('catch.likersMany', { a: names[0], b: names[1], n: names.length - 2 })
}

const PHOTO_ZOOM = 1.12

// The photo, almost whole (a touch enlarged, see PHOTO_ZOOM). Where its proportions leave empty space (above and below a wide frame, at the sides
// of a narrow one) a blurred copy of the same picture fills it, and the sharp photo's edges fade into that copy,
// so there is no black void and no hard seam. A photo that fills the screen in some direction is not faded there.
function CatchPhotoLayer({ src, alt, tour, onZoom }: { src: string; alt: string; tour: boolean; onZoom: () => void }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [box, setBox] = useState<{ w: number; h: number } | null>(null)
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null)

  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el) return
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  useLayoutEffect(() => {
    const img = imgRef.current
    if (img?.complete && img.naturalWidth) setNat({ w: img.naturalWidth, h: img.naturalHeight })
  }, [src])

  let style: React.CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', objectPosition: '50% 36%' }
  if (box && nat && box.w > 0 && box.h > 0) {
    // 12% bigger than «fits whole»: the blurred bands above and below shrink, and a portrait frame loses about 6% at each side.
    const k = Math.min(box.w / nat.w, box.h / nat.h) * PHOTO_ZOOM
    const w = Math.round(nat.w * k)
    const h = Math.round(nat.h * k)
    // A little above the middle, so the facts at the bottom cover less of the picture.
    const left = Math.round((box.w - w) / 2)
    const top = Math.round((box.h - h) * 0.36)
    const fadeV = h < box.h - 2 ? Math.round(Math.min(56, h * 0.12)) : 0
    const fadeH = w < box.w - 2 ? Math.round(Math.min(40, w * 0.1)) : 0
    const masks: string[] = []
    if (fadeV) masks.push(`linear-gradient(to bottom, transparent 0, #000 ${fadeV}px, #000 calc(100% - ${fadeV}px), transparent 100%)`)
    if (fadeH) masks.push(`linear-gradient(to right, transparent 0, #000 ${fadeH}px, #000 calc(100% - ${fadeH}px), transparent 100%)`)
    style = { position: 'absolute', left, top, width: w, height: h }
    if (masks.length) {
      const mask = masks.join(', ')
      Object.assign(style, { WebkitMaskImage: mask, maskImage: mask, WebkitMaskComposite: 'source-in', maskComposite: 'intersect' })
    }
  }

  return (
    <div ref={boxRef} style={{ position: 'absolute', inset: 0, cursor: 'zoom-in' }} onClick={onZoom}>
      <img className="catch-reel-ambient" src={src} alt="" aria-hidden />
      <img ref={imgRef} data-catch-photo data-tour={tour ? 'photo-zoom' : undefined} src={src} alt={alt} style={{ display: 'block', ...style }} onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
    </div>
  )
}

// Who caught it, Reels-style: round avatar and the name (the name opens the profile).
function CatchAuthor({ userId, mine, onOpenUser }: { userId: string; mine: boolean; onOpenUser: (id: string) => void }) {
  const { data: profile } = useProfile(userId)
  const name = mine ? tn('sector.you') : (profile?.displayName ?? '')
  const avatar = (
    <span className="reel-avatar" aria-hidden>
      {profile?.avatarUrl ? <img src={thumbUrl(profile.avatarUrl, 96)} alt="" loading="lazy" decoding="async" /> : (name || '?').slice(0, 1).toUpperCase()}
    </span>
  )
  if (mine) {
    return (
      <span className="reel-author">
        {avatar}
        <span className="reel-author-name">{name}</span>
      </span>
    )
  }
  return (
    <button className="reel-author" onClick={() => onOpenUser(userId)}>
      {avatar}
      {name ? <span className="reel-author-name">{name}</span> : <span className="skel" style={{ display: 'inline-block', width: 64, height: 9 }} />}
    </button>
  )
}

// «Подписаться» right beside the name, like Reels: a pill that flips to «Отписаться» once followed.
function FollowPill({ userId }: { userId: string }) {
  const { data: isFollowing } = useIsFollowing(userId)
  const setFollowing = useSetFollowing()
  return (
    <button className={`reel-pill tap-scale${isFollowing ? ' on' : ''}`} disabled={setFollowing.isPending} onClick={() => setFollowing.mutate({ followeeId: userId, following: !isFollowing })}>
      {isFollowing ? tn('profile.unfollow') : tn('profile.follow')}
    </button>
  )
}

// A real screen (pushed on the stack, reachable via ?catch=<id>) rather than
// the old bare-overlay lightbox — see FishZoneApp's openCatchPhoto. Replaces
// the flat catch-list row's cramped report/delete buttons with real touch
// targets here instead (see TerritoryScreen.tsx's own comment on why they
// moved). Self-contained like MyCatchesScreen/AchievementDetailScreen — a
// shared link may open straight into this screen with nothing else loaded.
export function CatchPhotoScreen({
  catchId,
  active,
  onBack,
  onOpenUser,
  onOpenTerritory,
  onShare,
  onToast,
  onReportPhoto,
  onDeleteCatch,
  onOpenLikers,
  onOpenComments,
}: {
  catchId: number
  // False once the screen is no longer the one on top (the screens stay
  // mounted) — an open photo viewer goes with it.
  active: boolean
  onBack: () => void
  onOpenUser: (id: string) => void
  onOpenTerritory: (id: string) => void
  onShare: (catchId: number, text: string) => void
  onToast: (msg: string) => void
  onReportPhoto: (catchId: number) => void
  onDeleteCatch: (catchId: number) => void
  onOpenLikers: (likers: ProfileSummary[]) => void
  onOpenComments: (catchId: number) => void
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
  const [syncedCatchId, setSyncedCatchId] = useState(catchId)
  if (catchId !== syncedCatchId) {
    setSyncedCatchId(catchId)
    setActiveId(catchId)
  }

  const { data: c } = useCatchById(activeId)
  const { data: likes } = useCatchLikes(activeId)
  const { data: comments = [] } = useCatchComments(activeId)
  const { data: sectorCatches = [] } = useCatchesByTerritory(c?.territoryId ?? null)
  const toggleLike = useToggleCatchLike()
  // Only the tap that ADDS a like plays the pop — matches Twitter/Instagram
  // convention (removing a like is a quiet, neutral action). The mutation
  // is optimistic (see useToggleCatchLike) so this fires on the tap itself,
  // not once the network round-trip resolves.
  const [justLiked, setJustLiked] = useState(false)
  const [moving, setMoving] = useState(false)
  const [zoomed, setZoomed] = useState(false)
  if (zoomed && !active) setZoomed(false)
  const [editing, setEditing] = useState(false)
  const [editingMine, setEditingMine] = useState(false)

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

  // Opened by link (or a catch not in any list yet): the photo's dark frame
  // and the sheet's lines while it loads, not an empty screen.
  if (!c) {
    return (
      <div className="screen-inner" style={{ padding: 0, display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0 }} aria-busy="true">
        <div className="catch-photo-skel" style={{ position: 'relative', flex: '1 1 auto', minHeight: 0 }}>
          <div style={{ position: 'absolute', top: 'calc(12px + var(--standalone-top, 0px))', left: 12 }}>
            <BackButton onClick={onBack} registerNative={false} />
          </div>
          <div style={{ position: 'absolute', left: 16, bottom: 'calc(var(--nav-h, 82px) + 14px)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="catch-reel-skel" style={{ width: 110, height: 12 }} />
            <div className="catch-reel-skel" style={{ width: 190, height: 24 }} />
            <div className="catch-reel-skel" style={{ width: 240, height: 14 }} />
          </div>
        </div>
      </div>
    )
  }
  const meta = formatCatchMeta(c.lengthCm, c.weightKg)
  const likedByMe = likes?.likedByMe ?? false
  const commentCount = comments.filter((cm) => !cm.deleted).length
  // The two latest live comments, replies included — a thread whose root
  // was deleted would otherwise leave the preview empty under a non-zero count.
  const commentPreview = comments.filter((cm) => !cm.deleted).slice(-2)

  function handleToggleLike() {
    if (!user) return
    if (!likedByMe) setJustLiked(true)
    toggleLike.mutate({ catchId: c!.id, liked: likedByMe })
  }

  const commentLine = commentPreview[commentPreview.length - 1]
  const iconStroke = { fill: 'none', stroke: '#fff', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

  return (
    // Like a Reels page: the photo takes the whole screen, shown whole (letterboxed on black, never cropped), who/what/where sit on it at the
    // bottom left over a soft blur, the reactions in a column at the right. No white sheet —
    // the photo gets all the room. Back and the owner's tools float over the top.
    // Touch handlers live on this outer shell (stays mounted across swipes)
    // so the keyed inner wrapper below is free to remount per catch without
    // dropping a gesture mid-swipe.
    <div
      className="screen-inner catch-reel"
      style={{ padding: 0, display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0 }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Keyed by activeId so the whole catch plays one simple fade-in as a
          unit when paging (see globals.css). */}
      <div key={activeId} className="catch-fade-in" style={{ position: 'relative', flex: '1 1 auto', minHeight: 0, background: '#000', overflow: 'hidden' }}>
        <CatchPhotoLayer src={c.photoUrl} alt={c.speciesName} tour={c.mine} onZoom={() => setZoomed(true)} />
        <div className="catch-reel-top" />
        <div className="catch-reel-shade" />
        {/* --standalone-top: the photo runs up under the status bar in
            the iPhone home-screen app, the buttons stay below its blur. */}
        <div style={{ position: 'absolute', top: 'calc(12px + var(--standalone-top, 0px))', left: 12 }}>
          <BackButton onClick={onBack} registerNative={false} className="catch-nav-btn" />
        </div>
        {isSuperAdmin && (
          <div style={{ position: 'absolute', top: 'calc(12px + var(--standalone-top, 0px))', right: 12, display: 'flex', gap: 8 }}>
            <div className="icon-btn catch-nav-btn tap-scale" onClick={() => setEditing(true)} title={tn('weekly.editTitle')}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
              </svg>
            </div>
            <div className="icon-btn catch-nav-btn tap-scale" onClick={() => setMoving(true)} title={tn('weekly.moveTitle')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 4 3 8l4 4M3 8h13a5 5 0 0 1 0 10h-3" />
              </svg>
            </div>
            <div className="icon-btn catch-nav-btn tap-scale" onClick={() => onDeleteCatch(c.id)} title={tn('weekly.deleteTitle')}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#D33" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M10 11v6M14 11v6M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
              </svg>
            </div>
          </div>
        )}
        {zoomed && <PhotoViewer src={c.photoUrl} alt={c.speciesName} onClose={() => setZoomed(false)} />}
        {c.mine && !isSuperAdmin && (
          <div style={{ position: 'absolute', top: 'calc(12px + var(--standalone-top, 0px))', right: 12 }}>
            <div className="icon-btn catch-nav-btn tap-scale" onClick={() => setEditingMine(true)} title={tn('catch.addDetailsTitle')} aria-label={tn('catch.addDetailsTitle')}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
              </svg>
            </div>
          </div>
        )}
        {editingMine && <EditMyCatchSheet c={c} onClose={() => setEditingMine(false)} />}
        {moving && <MoveCatchSheet c={c} onClose={() => setMoving(false)} />}
        {editing && <EditCatchSheet c={c} onClose={() => setEditing(false)} />}
        {sectorCatches.length > 1 && sectorIndex >= 0 && (
          <div className="catch-reel-counter" style={{ top: 'calc(12px + var(--standalone-top, 0px))' }}>
            {sectorIndex + 1} / {sectorCatches.length}
          </div>
        )}
        {prevCatch && (
          <div className="icon-btn catch-nav-btn tap-scale" style={{ position: 'absolute', top: '40%', left: 12, transform: 'translateY(-50%)' }} onClick={() => goTo(prevCatch.id)} title={tn('catch.prev')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </div>
        )}
        {nextCatch && (
          <div className="icon-btn catch-nav-btn tap-scale" style={{ position: 'absolute', top: '40%', right: 12, transform: 'translateY(-50%)' }} onClick={() => goTo(nextCatch.id)} title={tn('catch.next')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </div>
        )}

        {/* The reactions: like (its count opens who liked), comments, share, and — on someone else's catch — report. */}
        <div className="catch-reel-rail">
          <div className="reel-act-col">
            <button className={`reel-act tap-scale${justLiked ? ' like-pop-anim' : ''}`} onClick={handleToggleLike} aria-pressed={likedByMe} onAnimationEnd={() => setJustLiked(false)}>
              <svg width="30" height="30" viewBox="0 0 24 24" {...iconStroke} fill={likedByMe ? '#FF3B5C' : 'none'} stroke={likedByMe ? '#FF3B5C' : '#fff'}>
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>
            <button key={likes?.count ?? 0} className={`reel-count${justLiked ? ' like-count-pop-anim' : ''}`} onClick={() => (likes?.count ? onOpenLikers(likes.likers) : undefined)}>
              {likes?.count ?? 0}
            </button>
          </div>
          <div className="reel-act-col">
            <button className="reel-act tap-scale" onClick={() => onOpenComments(c.id)} aria-label={tn('guest.commentsAfter')}>
              <svg width="29" height="29" viewBox="0 0 24 24" {...iconStroke}>
                <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-4-.9L3 20l1.1-4a8.4 8.4 0 0 1-1.1-4.5A8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5z" />
              </svg>
            </button>
            <button className="reel-count" onClick={() => onOpenComments(c.id)}>
              {commentCount}
            </button>
          </div>
          <div className="reel-act-col">
            <button className="reel-act tap-scale" onClick={() => onShare(c.id, tn('catch.shareText', { species: c.speciesName }))} aria-label={tn('common.share')}>
              <svg width="28" height="28" viewBox="0 0 24 24" {...iconStroke}>
                <path d="M12 15V4M12 4 8 8M12 4l4 4" />
                <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
              </svg>
            </button>
          </div>
          {user && !c.mine && (
            <div className="reel-act-col">
              <button className="reel-act tap-scale" onClick={() => onReportPhoto(c.id)} aria-label={tn('catch.report')}>
                <svg width="25" height="25" viewBox="0 0 24 24" {...iconStroke}>
                  <path d="M5 3v18M5 4h12l-2.5 4L17 12H5" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Who caught it, what, where and when, the latest comment, the weather —
            on the blur at the bottom left, clear of the reactions column. */}
        <div className="catch-reel-info">
          <div className="reel-author-row">
            <CatchAuthor userId={c.userId} mine={c.mine} onOpenUser={onOpenUser} />
            {user && !c.mine && <FollowPill userId={c.userId} />}
            {c.mine && <StoryButton catchId={c.id} caption={`${c.speciesName}${meta ? ` ${meta}` : ''}`} onToast={onToast} />}
            {c.mine && (
              <button data-tour="edit-catch" className="reel-pill tap-scale" onClick={() => setEditingMine(true)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                </svg>
                {c.lengthCm == null && c.weightKg == null ? tn('catch.sizeWeight') : tn('catch.edit')}
              </button>
            )}
          </div>
          <div className="reel-species">
            {c.speciesName}
            {meta && <span className="reel-meta">{meta}</span>}
          </div>
          <div className="reel-where">
            <button className="reel-sector" onClick={() => onOpenTerritory(c.territoryId)}>
              {tn('guest.sectorTitle', { id: c.territoryId })}
            </button>
            <span>· {formatWhen(c.caughtAt)}</span>
          </div>
          <div className="reel-comments tap-scale" onClick={() => onOpenComments(c.id)}>
            {commentLine && (
              <div className="reel-comment-line">
                <b>{commentLine.displayName}</b> {commentLine.body}
              </div>
            )}
            <div className="reel-comment-more">{commentCount ? tn('catch.allComments', { count: commentCount }) : tn('catch.writeComment')}</div>
          </div>
          {/* A sideways scroll of the weather strip must not page to the next catch. */}
          <div className="reel-weather" onTouchStart={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()}>
            <CatchConditions catchId={c.id} caughtAt={c.caughtAt} territoryId={c.territoryId} compact />
          </div>
        </div>
      </div>
    </div>
  )
}
