'use client'

import { useAuth } from '@/components/providers/AuthProvider'
import { useCatchesByUser, useProfile } from '@/lib/supabase/queries'
import { formatCatchMeta, formatWhen } from '@/lib/format'

// Full catch history for one profile (own or someone else's, by userId) —
// ProfileScreen/UserProfileScreen only show a 3-item preview with a button
// into this screen. Self-contained (fetches its own catches by userId)
// rather than fed pre-computed data, matching AchievementsScreen.
export function MyCatchesScreen({
  userId,
  onBack,
  onOpenPhoto,
}: {
  userId: string
  onBack: () => void
  onOpenPhoto: (src: string) => void
}) {
  const { user } = useAuth()
  const { data: catches = [] } = useCatchesByUser(userId)
  const isOwn = userId === user?.id
  const { data: profile } = useProfile(isOwn ? null : userId)
  const title = isOwn ? 'Мои уловы' : `Уловы: ${profile?.displayName ?? '…'}`

  return (
    <>
      <div className="header-row">
        <div className="icon-btn tap-scale" onClick={onBack}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="icon-back">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </div>
        <div style={{ fontWeight: 800, fontSize: 15 }}>{title}</div>
        <div style={{ width: 36 }} />
      </div>
      <div className="screen-inner">
        <div className="card" style={{ overflow: 'hidden' }}>
          {catches.length ? (
            catches.map((c, i) => {
              const meta = formatCatchMeta(c.lengthCm, c.weightKg)
              return (
                <div
                  key={c.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: i < catches.length - 1 ? '1px solid var(--line)' : 'none' }}
                >
                  <div className="fish-thumb" style={{ width: 46, height: 46, cursor: 'pointer' }} onClick={() => onOpenPhoto(c.photoUrl)}>
                    <img src={c.photoUrl} alt={c.speciesName} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14.5 }}>{c.speciesName}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 1 }}>
                      {[meta, c.territoryId].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-faint)', fontWeight: 600, textAlign: 'right' }}>
                    {formatWhen(c.caughtAt).split('·')[0].trim()}
                  </div>
                </div>
              )
            })
          ) : (
            <div style={{ padding: '22px 14px', textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5 }}>Пока нет уловов</div>
          )}
        </div>
      </div>
    </>
  )
}
