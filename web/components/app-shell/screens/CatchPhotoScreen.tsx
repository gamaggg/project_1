'use client'

import { useState } from 'react'
import { useCatchById, useCatchLikes, useToggleCatchLike, useIsSuperAdmin } from '@/lib/supabase/queries'
import { useAuth } from '@/components/providers/AuthProvider'
import { formatCatchMeta, formatWhen } from '@/lib/format'
import { CatcherLabel } from '@/components/app-shell/screens/TerritoryScreen'
import { BackButton } from '@/components/app-shell/BackButton'

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
}: {
  catchId: number
  onBack: () => void
  onOpenUser: (id: string) => void
  onOpenTerritory: (id: string) => void
  onShare: (catchId: number, text: string) => void
  onReportPhoto: (catchId: number) => void
  onDeleteCatch: (catchId: number) => void
}) {
  const { user } = useAuth()
  const isSuperAdmin = useIsSuperAdmin()
  const { data: c } = useCatchById(catchId)
  const { data: likes } = useCatchLikes(catchId)
  const toggleLike = useToggleCatchLike()
  // Only the tap that ADDS a like plays the pop — matches Twitter/Instagram
  // convention (removing a like is a quiet, neutral action). The mutation
  // is optimistic (see useToggleCatchLike) so this fires on the tap itself,
  // not once the network round-trip resolves.
  const [justLiked, setJustLiked] = useState(false)

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
    <div className="screen-inner" style={{ padding: 0 }}>
      <div style={{ position: 'relative' }}>
        <img src={c.photoUrl} alt={c.speciesName} style={{ width: '100%', display: 'block' }} />
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
      </div>
      {/* A rounded-top sheet pulled up over the photo's bottom edge (common
          photo-detail pattern) reads as a distinct layer of facts/actions
          even though --surface and --bg are the same white — the shadow and
          the photo's own color underneath do the separating. */}
      <div
        style={{
          position: 'relative',
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
            <div key={likes?.count ?? 0} className={justLiked ? 'like-count-pop-anim' : undefined} style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-soft)', minWidth: 12 }}>
              {likes?.count ?? 0}
            </div>
          </div>
        </div>
        <div style={{ fontWeight: 800, fontSize: 20, marginTop: 4 }}>{c.speciesName}</div>
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
  )
}
