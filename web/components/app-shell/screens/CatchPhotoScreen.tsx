'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { thumbUrl } from '@/lib/supabase/imageUrl'
import { useCatchById, useCatchesByTerritory, useCatchesByUser, useCatchLikes, useToggleCatchLike, useIsSuperAdmin, useCatchComments, useCatchConditions, useProfile, useIsFollowing, useSetFollowing } from '@/lib/supabase/queries'
import { useAuth } from '@/components/providers/AuthProvider'
import { formatCatchMeta, formatWhen } from '@/lib/format'
import { CatchConditions } from '@/components/app-shell/CatchConditions'
import { StoryButton } from '@/components/app-shell/StoryButton'
import { downloadImage } from '@/lib/story'
import { BackButton } from '@/components/app-shell/BackButton'
import { PhotoViewer } from '@/components/app-shell/PhotoViewer'
import { EditMyCatchSheet } from '@/components/app-shell/EditMyCatchSheet'
import { EditCatchSheet, MoveCatchSheet } from '@/components/app-shell/lazyScreens'
import type { Catch, ProfileSummary } from '@/lib/data/types'
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
// The two blurred copies are drawn this many times smaller and stretched back: a blur is a buffer the size of what is
// blurred, and full-size copies on all three pages of the slider were enough for iOS to run out of graphics memory in
// Telegram (01.11, 02.11). Under the blur the picture looks the same (measured: 21 MB of the page's 49 MB gone).
const BLUR_SHRINK = 4

// The photo, almost whole (a touch enlarged, see PHOTO_ZOOM). Where its proportions leave empty space (above and below a wide frame, at the sides
// of a narrow one) a blurred copy of the same picture fills it, and the sharp photo's edges fade into that copy,
// so there is no black void and no hard seam. A photo that fills the screen in some direction is not faded there.
function CatchPhotoLayer({ src, alt, current, tour, onZoom }: { src: string; alt: string; current: boolean; tour: boolean; onZoom: () => void }) {
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

  // Until the picture's size is known it is not shown at all (it would be drawn unscaled, then jump to its real size).
  let style: React.CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', objectPosition: '50% 36%' }
  let softStyle: React.CSSProperties | null = null
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
    // The same place and size, drawn BLUR_SHRINK times smaller and stretched from its top left corner.
    softStyle = { position: 'absolute', left, top, width: w / BLUR_SHRINK, height: h / BLUR_SHRINK, transform: `scale(${BLUR_SHRINK})`, transformOrigin: '0 0', filter: `blur(${14 / BLUR_SHRINK}px)` }
  }

  return (
    <div ref={boxRef} className="catch-photo-layer" style={{ position: 'absolute', inset: 0, cursor: 'zoom-in' }} onClick={onZoom}>
      <img className="catch-reel-ambient" src={src} alt="" aria-hidden decoding="async" />
      <img ref={imgRef} data-catch-photo={current || undefined} data-tour={tour ? 'photo-zoom' : undefined} src={src} alt={alt} decoding="async" style={{ display: 'block', opacity: nat ? 1 : 0, transition: 'opacity .2s ease-out', ...style }} onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
      {/* The soft blur under the facts at the bottom: a blurred copy of the photo that slides with it. A backdrop blur
          over sliding photos is redrawn every frame, which is what made paging stutter on phones. */}
      <div className="catch-photo-soft" aria-hidden>
        {softStyle && <img src={src} alt="" decoding="async" style={softStyle} />}
      </div>
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

// Room between two photos while paging, like a photo gallery's.
const PAGE_GAP = 12
const SETTLE_MS = 320
// How far ahead (each way) the photos are fetched; only the next one each way is on the page, the rest is just in the browser's cache.
const PRELOAD_AHEAD = 2

type CatchPageHandlers = {
  onOpenUser: (id: string) => void
  onOpenTerritory: (id: string) => void
  onShare: (catchId: number, text: string) => void
  onToast: (msg: string) => void
  onReportPhoto: (catchId: number) => void
  onDeleteCatch: (catchId: number) => void
  onOpenLikers: (likers: ProfileSummary[]) => void
  onOpenComments: (catchId: number) => void
}

// A real screen (pushed on the stack, reachable via ?catch=<id>) rather than
// the old bare-overlay lightbox — see FishZoneApp's openCatchPhoto. Replaces
// the flat catch-list row's cramped report/delete buttons with real touch
// targets here instead (see TerritoryScreen.tsx's own comment on why they
// moved). Self-contained like MyCatchesScreen/AchievementDetailScreen — a
// shared link may open straight into this screen with nothing else loaded.
// Pages through the list it was opened from: a player's catches (feedUserId,
// from a profile or «Мои уловы»), only some of them in a set order (feedIds with
// feedUserId: the profile's «Трофеи»), or else the catch's sector. Only the photos
// slide (they follow the finger, the neighbours beside them); the facts and
// reactions stay on the screen and swap what changed once the page lands.
export function CatchPhotoScreen({
  catchId,
  feedUserId,
  feedIds = null,
  active,
  onBack,
  ...handlers
}: {
  catchId: number
  feedUserId: string | null
  feedIds?: number[] | null
  // False once the screen is no longer the one on top (the screens stay
  // mounted) — an open photo viewer goes with it.
  active: boolean
  onBack: () => void
} & CatchPageHandlers) {
  // Paging swaps which catch this screen shows without pushing a new stack
  // entry per swipe (which would make "back" have to click through every
  // catch you passed). FishZoneApp keys this screen by each opening, so a
  // new tap on a catch (even the one opened last time) starts from it.
  const [activeId, setActiveId] = useState(catchId)
  const [zoomed, setZoomed] = useState(false)
  if (zoomed && !active) setZoomed(false)

  const { data: byId } = useCatchById(activeId)
  // The sector of the catch it was opened on, kept: every catch paged to is in it, and the list must not drop
  // out while the next catch's own fetch is on the way.
  const [sectorId, setSectorId] = useState<string | null>(null)
  if (!feedUserId && !sectorId && byId?.territoryId) setSectorId(byId.territoryId)
  const { data: byUser = [] } = useCatchesByUser(feedUserId)
  const { data: bySector = [] } = useCatchesByTerritory(feedUserId ? null : sectorId)
  const feed = feedUserId ? (feedIds ? feedIds.flatMap((id) => byUser.filter((x) => x.id === id)) : byUser) : bySector
  const index = feed.findIndex((x) => x.id === activeId)
  // The list already has the catch while its own fetch is on the way, so a page turn never shows a blank screen.
  const c = byId?.id === activeId ? byId : index >= 0 ? feed[index] : undefined
  const prevCatch = index > 0 ? feed[index - 1] : null
  const nextCatch = index >= 0 && index < feed.length - 1 ? feed[index + 1] : null

  // The neighbours' likes, comments and weather are fetched ahead too, so the facts below change the moment the page lands.
  useCatchLikes(prevCatch?.id ?? null)
  useCatchLikes(nextCatch?.id ?? null)
  useCatchComments(prevCatch?.id ?? null)
  useCatchComments(nextCatch?.id ?? null)
  useCatchConditions(prevCatch?.id ?? null)
  useCatchConditions(nextCatch?.id ?? null)

  // The photos two pages away each way are fetched ahead; the next ones are on the page already.
  const ahead = index >= 0 ? [feed[index - PRELOAD_AHEAD]?.photoUrl, feed[index + PRELOAD_AHEAD]?.photoUrl].filter(Boolean).join(' ') : ''
  useEffect(() => {
    for (const url of ahead.split(' ')) {
      if (!url) continue
      // Decoded too, off the main thread, so the photo is ready to draw when it slides in.
      const img = new Image()
      img.decoding = 'async'
      img.src = url
      img.decode().catch(() => {})
    }
  }, [ahead])

  const shellRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  // The track is moved by hand (no re-render per finger move); React never sets its transform.
  function setTrack(px: number, ms: number) {
    const el = trackRef.current
    if (!el) return
    el.style.transition = ms ? `transform ${ms}ms cubic-bezier(.22,.8,.28,1)` : 'none'
    el.style.transform = px ? `translate3d(${px}px,0,0)` : ''
  }
  // After a page turn the new catch sits in the middle slot: the track goes back to 0 before the frame is drawn.
  useLayoutEffect(() => setTrack(0, 0), [activeId])

  // One page step: the screen's width and the gap between photos.
  const pageWidth = () => (shellRef.current?.clientWidth ?? 0) + PAGE_GAP
  const settling = useRef<{ toId: number | null; dir: number; timer: number } | null>(null)
  // The new catch is put in the middle in the same frame the slide ends (flushSync), so the old one never flashes back.
  function finishSettle() {
    const s = settling.current
    if (!s) return
    settling.current = null
    window.clearTimeout(s.timer)
    if (s.toId != null) flushSync(() => setActiveId(s.toId!))
  }
  // The neighbours as of the last commit: a slide ended with flushSync mid-handler must not use the stale ones.
  const nav = useRef({ prevCatch, nextCatch })
  useLayoutEffect(() => {
    nav.current = { prevCatch, nextCatch }
  })
  // dir 1 = to the next catch, -1 = to the previous one, 0 = back into place.
  function settle(dir: -1 | 0 | 1) {
    const to = dir === 1 ? nav.current.nextCatch : dir === -1 ? nav.current.prevCatch : null
    if (to && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setActiveId(to.id)
      return
    }
    setTrack(to ? -dir * pageWidth() : 0, SETTLE_MS)
    settling.current = { toId: to?.id ?? null, dir: to ? dir : 0, timer: window.setTimeout(finishSettle, SETTLE_MS + 60) }
  }
  // A new touch (or arrow) while a page is still sliding takes it over where it is now, like a native gallery:
  // the slide is ended on the spot and the track keeps the same place on the screen. Returns that offset.
  function interruptSettle(): number {
    const s = settling.current
    const el = trackRef.current
    if (!s || !el) return 0
    let x = new DOMMatrixReadOnly(getComputedStyle(el).transform).m41
    settling.current = null
    window.clearTimeout(s.timer)
    if (s.toId != null) {
      flushSync(() => setActiveId(s.toId!))
      x += s.dir * pageWidth()
    }
    setTrack(x, 0)
    return x
  }

  // The finger drags the pages; which way it is going is decided after the first few pixels, an up-down move is left alone.
  // base: where the track was when the finger came down (mid-slide it is not 0); w: the screen width, read once per gesture.
  const gesture = useRef<{ x: number; y: number; base: number; w: number; axis: 'x' | 'y' | null; dx: number; lastX: number; lastT: number; v: number } | null>(null)
  const suppressClickUntil = useRef(0)
  function handleTouchStart(e: React.TouchEvent) {
    // Touches in a sheet or the zoom viewer (portals, outside this element) are not page turns.
    if (e.touches.length > 1 || !shellRef.current?.contains(e.target as Node)) {
      gesture.current = null
      return
    }
    const base = interruptSettle()
    const t = e.touches[0]
    // Caught mid-slide, the finger is already dragging the page sideways.
    gesture.current = { x: t.clientX, y: t.clientY, base, w: shellRef.current.clientWidth || 1, axis: base ? 'x' : null, dx: base, lastX: t.clientX, lastT: e.timeStamp, v: 0 }
  }
  function handleTouchMove(e: React.TouchEvent) {
    const g = gesture.current
    if (!g) return
    if (e.touches.length > 1) {
      gesture.current = null
      if (g.axis === 'x') settle(0)
      return
    }
    const t = e.touches[0]
    const mx = t.clientX - g.x
    const my = t.clientY - g.y
    if (!g.axis) {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return
      g.axis = Math.abs(mx) > Math.abs(my) ? 'x' : 'y'
    }
    if (g.axis !== 'x') return
    const dt = e.timeStamp - g.lastT
    if (dt > 0) g.v = 0.75 * ((t.clientX - g.lastX) / dt) + 0.25 * g.v
    g.lastX = t.clientX
    g.lastT = e.timeStamp
    // Past the first or the last catch the page gives only a little and harder the further it goes.
    const dx = g.base + mx
    const edge = (dx > 0 && !nav.current.prevCatch) || (dx < 0 && !nav.current.nextCatch)
    g.dx = edge ? Math.sign(dx) * g.w * 0.28 * (1 - 1 / (Math.abs(dx) / g.w + 1)) : dx
    setTrack(g.dx, 0)
  }
  function handleTouchEnd(e: React.TouchEvent) {
    const g = gesture.current
    gesture.current = null
    if (!g || g.axis !== 'x') return
    suppressClickUntil.current = performance.now() + 400
    // A finger that stopped before letting go has no flick left in it.
    const v = e.timeStamp - g.lastT > 90 ? 0 : g.v
    // Caught mid-slide and let go without dragging: it lands on whichever photo is nearer.
    if (g.base && Math.abs(g.lastX - g.x) < 8) settle(g.dx < -g.w / 2 ? 1 : g.dx > g.w / 2 ? -1 : 0)
    else if ((g.dx < -g.w * 0.3 || v < -0.35) && g.dx < 0) settle(1)
    else if ((g.dx > g.w * 0.3 || v > 0.35) && g.dx > 0) settle(-1)
    else settle(0)
  }
  function handleTouchCancel() {
    const g = gesture.current
    gesture.current = null
    if (g?.axis === 'x') settle(0)
  }
  function handleArrow(dir: -1 | 1) {
    interruptSettle()
    settle(dir)
  }
  // Letting go after a drag must not count as a tap on the photo (that opens the zoom).
  function handleClickCapture(e: React.MouseEvent) {
    if (performance.now() < suppressClickUntil.current) {
      e.stopPropagation()
      e.preventDefault()
    }
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

  const pages = [
    { c: prevCatch, at: -1 },
    { c, at: 0 },
    { c: nextCatch, at: 1 },
  ].filter((p): p is { c: Catch; at: number } => !!p.c)

  return (
    // Like a Reels page: the photo takes the whole screen, shown whole (letterboxed on black, never cropped), who/what/where sit on it at the
    // bottom left over a soft blur, the reactions in a column at the right. No white sheet —
    // the photo gets all the room. Only the photos slide; everything over them stays put.
    <div
      ref={shellRef}
      className="screen-inner catch-reel"
      style={{ padding: 0, display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0 }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      onClickCapture={handleClickCapture}
    >
      <div style={{ position: 'relative', flex: '1 1 auto', minHeight: 0, background: '#000', overflow: 'hidden' }}>
        <div ref={trackRef} className="catch-track" onTransitionEnd={(e) => e.target === e.currentTarget && finishSettle()}>
          {pages.map((p) => (
            <div key={p.c.id} className="catch-page" style={{ transform: p.at ? `translate3d(calc(${p.at} * (100% + ${PAGE_GAP}px)),0,0)` : undefined }} aria-hidden={p.at !== 0 || undefined}>
              <CatchPhotoLayer src={p.c.photoUrl} alt={p.c.speciesName} current={p.at === 0} tour={p.at === 0 && p.c.mine} onZoom={() => p.at === 0 && setZoomed(true)} />
            </div>
          ))}
        </div>
        <div className="catch-reel-top" />
        <div className="catch-reel-shade" />
        {/* --standalone-top: the photo runs up under the status bar in
            the iPhone home-screen app, the buttons stay below its blur. */}
        <div style={{ position: 'absolute', top: 'calc(12px + var(--standalone-top, 0px))', left: 12 }}>
          <BackButton onClick={onBack} registerNative={false} className="catch-nav-btn" />
        </div>
        {feed.length > 1 && index >= 0 && (
          <div className="catch-reel-counter" style={{ top: 'calc(12px + var(--standalone-top, 0px))' }}>
            {/* The player's and the sector's catches come newest first, but are numbered as they were caught: the latest
                one is the highest number («91 / 91»), the very first «1 / 91». «Трофеи» (feedIds) are a ranking by size,
                so there the biggest is «1». */}
            {feedIds && feedUserId ? index + 1 : feed.length - index} / {feed.length}
          </div>
        )}
        {/* No circles: just a see-through chevron at each edge (the touch area stays a comfortable size). */}
        {prevCatch && (
          <div className="catch-arrow tap-scale" style={{ left: 4 }} onClick={() => handleArrow(-1)} title={tn('catch.prev')} role="button" aria-label={tn('catch.prev')}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </div>
        )}
        {nextCatch && (
          <div className="catch-arrow tap-scale" style={{ right: 4 }} onClick={() => handleArrow(1)} title={tn('catch.next')} role="button" aria-label={tn('catch.next')}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9 5l7 7-7 7" />
            </svg>
          </div>
        )}
        {zoomed && <PhotoViewer src={c.photoUrl} alt={c.speciesName} onClose={() => setZoomed(false)} />}
        <CatchFacts c={c} {...handlers} />
      </div>
    </div>
  )
}

// What sits over the photo: the owner's and admin's tools, the reactions and the facts at the bottom. It stays mounted while
// the photos page; each fact is keyed by its value, so after a page turn only what actually changed comes in (a short rise
// and fade), and what is the same (the author on a profile's catches, the buttons) does not move.
function CatchFacts({
  c,
  onOpenUser,
  onOpenTerritory,
  onShare,
  onToast,
  onReportPhoto,
  onDeleteCatch,
  onOpenLikers,
  onOpenComments,
}: { c: Catch } & CatchPageHandlers) {
  const { user } = useAuth()
  const isSuperAdmin = useIsSuperAdmin()
  const { data: likes } = useCatchLikes(c.id)
  const { data: comments = [] } = useCatchComments(c.id)
  const toggleLike = useToggleCatchLike()
  // Only the tap that ADDS a like plays the pop — matches Twitter/Instagram
  // convention (removing a like is a quiet, neutral action). The mutation
  // is optimistic (see useToggleCatchLike) so this fires on the tap itself,
  // not once the network round-trip resolves.
  const [justLiked, setJustLiked] = useState(false)
  const [moving, setMoving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editingMine, setEditingMine] = useState(false)

  // A fact that mounts after the first render (its key changed: a page turn) plays the swap-in; the first render doesn't.
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
  }, [])
  const likeTapped = useRef(false)
  const swapIn = useCallback((el: HTMLElement | null) => {
    if (!el || !mounted.current) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    el.animate([{ opacity: 0, transform: 'translate3d(0,6px,0)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'cubic-bezier(.22,1,.36,1)' })
  }, [])
  // The like count's own tap plays the pop, not the swap.
  const countSwapIn = useCallback(
    (el: HTMLElement | null) => {
      if (el && likeTapped.current) {
        likeTapped.current = false
        return
      }
      swapIn(el)
    },
    [swapIn]
  )

  const meta = formatCatchMeta(c.lengthCm, c.weightKg)
  const likedByMe = likes?.likedByMe ?? false
  const likeCount = likes?.count ?? 0
  const commentCount = comments.filter((cm) => !cm.deleted).length
  // The two latest live comments, replies included — a thread whose root
  // was deleted would otherwise leave the preview empty under a non-zero count.
  const commentPreview = comments.filter((cm) => !cm.deleted).slice(-2)

  function handleToggleLike() {
    if (!user) return
    likeTapped.current = true
    if (!likedByMe) setJustLiked(true)
    toggleLike.mutate({ catchId: c.id, liked: likedByMe })
  }

  const commentLine = commentPreview[commentPreview.length - 1]
  const when = formatWhen(c.caughtAt)
  const editLabel = c.lengthCm == null && c.weightKg == null ? tn('catch.sizeWeight') : tn('catch.edit')
  const iconStroke = { fill: 'none', stroke: '#fff', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

  return (
    <>
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

      {/* The reactions: like (its count opens who liked), comments, share, and — on someone else's catch — report. */}
      <div className="catch-reel-rail">
        <div className="reel-act-col">
          <button className={`reel-act tap-scale${justLiked ? ' like-pop-anim' : ''}`} onClick={handleToggleLike} aria-pressed={likedByMe} onAnimationEnd={() => setJustLiked(false)}>
            <svg width="30" height="30" viewBox="0 0 24 24" {...iconStroke} fill={likedByMe ? '#FF3B5C' : 'none'} stroke={likedByMe ? '#FF3B5C' : '#fff'}>
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
          <button key={likeCount} ref={countSwapIn} className={`reel-count${justLiked ? ' like-count-pop-anim' : ''}`} onClick={() => (likeCount ? onOpenLikers(likes!.likers) : undefined)}>
            {likeCount}
          </button>
        </div>
        <div className="reel-act-col">
          <button className="reel-act tap-scale" onClick={() => onOpenComments(c.id)} aria-label={tn('guest.commentsAfter')}>
            <svg width="29" height="29" viewBox="0 0 24 24" {...iconStroke}>
              <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-4-.9L3 20l1.1-4a8.4 8.4 0 0 1-1.1-4.5A8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5z" />
            </svg>
          </button>
          <button key={commentCount} ref={swapIn} className="reel-count" onClick={() => onOpenComments(c.id)}>
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
        <div key={c.userId} ref={swapIn} className="reel-author-row">
          <CatchAuthor userId={c.userId} mine={c.mine} onOpenUser={onOpenUser} />
          {user && !c.mine && <FollowPill userId={c.userId} />}
        </div>
        {/* The owner's two buttons get their own row: beside the name they squeezed it down to one letter. */}
        {c.mine && (
          <div className="reel-mine-row">
            <StoryButton catchId={c.id} caption={`${c.speciesName}${meta ? ` ${meta}` : ''}`} onToast={onToast} />
            <DownloadPhotoButton catchId={c.id} photoUrl={c.photoUrl} onToast={onToast} />
            <button key={editLabel} ref={swapIn} data-tour="edit-catch" className="reel-pill tap-scale" onClick={() => setEditingMine(true)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
              </svg>
              {editLabel}
            </button>
          </div>
        )}
        <div key={`${c.speciesName}|${meta}`} ref={swapIn} className="reel-species">
          {c.speciesName}
          {meta && <span className="reel-meta">{meta}</span>}
        </div>
        <div className="reel-where">
          <button key={c.territoryId} ref={swapIn} className="reel-sector" onClick={() => onOpenTerritory(c.territoryId)}>
            {tn('guest.sectorTitle', { id: c.territoryId })}
          </button>
          <span key={when} ref={swapIn}>
            · {when}
          </span>
        </div>
        <div key={`${commentCount}|${commentLine?.id ?? ''}`} ref={swapIn} className="reel-comments tap-scale" onClick={() => onOpenComments(c.id)}>
          {commentLine && (
            <div className="reel-comment-line">
              <b>{commentLine.displayName}</b> {commentLine.body}
            </div>
          )}
          <div className="reel-comment-more">{commentCount ? tn('catch.allComments', { count: commentCount }) : tn('catch.writeComment')}</div>
        </div>
        {/* A sideways scroll of the weather strip must not turn the page. */}
        <div key={c.id} ref={swapIn} className="reel-weather" onTouchStart={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()}>
          <CatchConditions catchId={c.id} caughtAt={c.caughtAt} territoryId={c.territoryId} compact />
        </div>
      </div>
    </>
  )
}

// «Скачать фото» — the owner saves the stored photo (1600 px JPEG, the size
// every catch photo is kept at): Telegram's own save prompt, or a plain
// download in a browser (lib/story.ts). Icon only, so the owner's row stays
// one line on a narrow phone.
function DownloadPhotoButton({ catchId, photoUrl, onToast }: { catchId: number; photoUrl: string; onToast: (msg: string) => void }) {
  const [busy, setBusy] = useState(false)

  async function download() {
    setBusy(true)
    const result = await downloadImage(photoUrl, `range-${catchId}.jpg`)
    setBusy(false)
    if (result === 'downloaded') onToast(tn('catch.photoSaved'))
    if (result === 'failed') onToast(tn('catch.photoSaveFailed'))
  }

  return (
    <button className="reel-pill reel-pill-icon tap-scale" disabled={busy} onClick={() => void download()} aria-label={tn('catch.downloadPhoto')} title={tn('catch.downloadPhoto')}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />
      </svg>
    </button>
  )
}
