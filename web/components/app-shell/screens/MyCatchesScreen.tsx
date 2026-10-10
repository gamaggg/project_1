'use client'

import { SkeletonRows } from '@/components/app-shell/Skeleton'
import { useState } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { thumbUrl } from '@/lib/supabase/imageUrl'
import { useCatchesByUser, useCatchesByTerritory, useProfile } from '@/lib/supabase/queries'
import { formatCatchMeta, formatWhen } from '@/lib/format'
import { CatcherLabel } from '@/components/app-shell/screens/TerritoryScreen'
import { BackButton } from '@/components/app-shell/BackButton'
import { DiaryView } from '@/components/app-shell/Diary'
import { useT } from '@/lib/i18n'

// Full catch history — either one profile's (own or someone else's, by
// userId; ProfileScreen/UserProfileScreen show a 3-item preview with a button
// in here) or one sector's (by territoryId, from TerritoryScreen's "Все
// уловы" — spans different catchers, so rows show who caught each one).
// Self-contained (fetches its own catches) rather than fed pre-computed data,
// matching AchievementsScreen.
export function MyCatchesScreen({
  userId,
  territoryId,
  onBack,
  onOpenPhoto,
  onOpenUser,
  onOpenTerritory,
  onToast,
}: {
  userId?: string
  territoryId?: string
  onBack: () => void
  onOpenPhoto: (catchId: number) => void
  onOpenTerritory?: (id: string) => void
  onOpenUser: (id: string) => void
  onToast: (msg: string) => void
}) {
  const t = useT()
  const [tab, setTab] = useState<'catches' | 'diary'>('catches')
  const { user } = useAuth()
  const { data: byUser = [], isPending: byUserPending } = useCatchesByUser(territoryId ? null : (userId ?? null))
  const { data: byTerritory = [], isPending: byTerritoryPending } = useCatchesByTerritory(territoryId ?? null)
  const catches = territoryId ? byTerritory : byUser
  const catchesPending = territoryId ? byTerritoryPending : byUserPending
  const isOwn = !territoryId && userId === user?.id
  const { data: profile } = useProfile(!territoryId && !isOwn ? (userId ?? null) : null)
  const title = territoryId ? `Уловы: ${territoryId}` : isOwn ? 'Мои уловы' : `Уловы: ${profile?.displayName ?? '…'}`

  return (
    <>
      <div className="header-row">
        <BackButton onClick={onBack} registerNative={false} />
        <div style={{ fontWeight: 800, fontSize: 15 }}>{title}</div>
        <div style={{ width: 36 }} />
      </div>
      <div className="screen-inner">
        {isOwn && (
          <div className="diary-tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'catches'} className={tab === 'catches' ? 'on' : undefined} onClick={() => setTab('catches')}>
              {t('diary.tabCatches')}
            </button>
            <button role="tab" data-tour={tab === 'catches' ? 'diary-tab' : undefined} aria-selected={tab === 'diary'} className={tab === 'diary' ? 'on' : undefined} onClick={() => setTab('diary')}>
              {t('diary.tabDiary')}
            </button>
          </div>
        )}
        {isOwn && tab === 'diary' ? (
          <DiaryView onOpenPhoto={onOpenPhoto} onOpenTerritory={onOpenTerritory} onToast={onToast} />
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            {catches.length ? (
              catches.map((c, i) => {
                const meta = formatCatchMeta(c.lengthCm, c.weightKg)
                return (
                  <div
                    key={c.id}
                    className="tap-scale"
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: i < catches.length - 1 ? '1px solid var(--line)' : 'none', cursor: 'pointer' }}
                    onClick={() => onOpenPhoto(c.id)}
                  >
                    <div className="fish-thumb" style={{ width: 46, height: 46 }}>
                      <img src={thumbUrl(c.photoUrl, 160)} alt={c.speciesName} loading="lazy" decoding="async" />
                    </div>
                    <div style={{ flex: 1 }}>
                      {territoryId && <CatcherLabel userId={c.userId} mine={c.mine} onOpenUser={onOpenUser} />}
                      <div style={{ fontWeight: 700, fontSize: 14.5 }}>{c.speciesName}</div>
                      {(meta || !territoryId) && (
                        <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 1 }}>
                          {[meta, territoryId ? null : c.territoryId].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-faint)', fontWeight: 600, textAlign: 'right' }}>
                      {formatWhen(c.caughtAt).split('·')[0].trim()}
                    </div>
                  </div>
                )
              })
            ) : (
              catchesPending ? (
                <SkeletonRows count={5} />
              ) : (
                <div style={{ padding: '22px 14px', textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5 }}>Пока нет уловов</div>
              )
            )}
          </div>
        )}
      </div>
    </>
  )
}
