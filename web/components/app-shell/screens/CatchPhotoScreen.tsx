'use client'

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

  async function handleDownload() {
    if (!c) return
    const res = await fetch(c.photoUrl)
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = `range-${c.id}.jpg`
    a.click()
    URL.revokeObjectURL(objectUrl)
  }

  if (!c) return null
  const meta = formatCatchMeta(c.lengthCm, c.weightKg)
  const likedByMe = likes?.likedByMe ?? false

  return (
    <>
      <div className="header-row">
        <BackButton onClick={onBack} registerNative={false} />
        <div style={{ display: 'flex', gap: 8 }}>
          {isSuperAdmin && (
            <div className="icon-btn tap-scale" onClick={() => onDeleteCatch(c.id)} title="Удалить улов">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#D33" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M10 11v6M14 11v6M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
              </svg>
            </div>
          )}
          <div className="icon-btn tap-scale" onClick={() => onShare(c.id, `🎣 ${c.speciesName} в RANGE`)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 15V4M12 4 8 8M12 4l4 4" />
              <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
            </svg>
          </div>
        </div>
      </div>
      {/* .screen-inner's default padding (globals.css) reserves 100px at the
          bottom to clear the fixed bottom nav — bleeding the photo to the
          edges pulls it out with negative margins instead of zeroing that
          padding outright, which hid the action row under the nav bar. */}
      <div className="screen-inner">
        <img src={c.photoUrl} alt={c.speciesName} style={{ width: '100%', display: 'block', margin: '-6px -20px 0' }} />
        <div style={{ paddingTop: 16 }}>
          <CatcherLabel userId={c.userId} mine={c.mine} onOpenUser={onOpenUser} />
          <div style={{ fontWeight: 800, fontSize: 19 }}>{c.speciesName}</div>
          {meta && <div style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginTop: 2 }}>{meta}</div>}
          <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 4 }}>{formatWhen(c.caughtAt)}</div>
          <button className="section-link" style={{ marginTop: 8 }} onClick={() => onOpenTerritory(c.territoryId)}>
            Сектор {c.territoryId}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 18 }}>
            <div
              className="icon-btn tap-scale"
              style={likedByMe ? { background: 'rgba(211,51,51,0.1)', border: '1px solid rgba(211,51,51,0.3)' } : undefined}
              onClick={() => user && toggleLike.mutate({ catchId: c.id, liked: likedByMe })}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill={likedByMe ? '#D33' : 'none'} stroke={likedByMe ? '#D33' : '#17181B'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 21s-7.5-4.7-10-9.3C.5 8.2 2.3 5 6 5c2 0 3.5 1.1 4.5 2.7C11.5 6.1 13 5 15 5c3.7 0 5.5 3.2 4 6.7C19.5 16.3 12 21 12 21z" />
              </svg>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-soft)' }}>{likes?.count ?? 0}</div>
            <div style={{ flex: 1 }} />
            {user && !c.mine && (
              <button className="btn-secondary" style={{ width: 'auto', padding: '9px 14px', fontSize: 13 }} onClick={() => onReportPhoto(c.id)}>
                Пожаловаться
              </button>
            )}
            <button className="btn-secondary" style={{ width: 'auto', padding: '9px 14px', fontSize: 13 }} onClick={handleDownload}>
              Скачать
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
