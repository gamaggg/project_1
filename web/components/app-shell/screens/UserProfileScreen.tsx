'use client'

import { useProfile, useCatchesByUser, useIsFollowing, useSetFollowing } from '@/lib/supabase/queries'
import { computeAchievements, personalRecord } from '@/lib/data/achievements'
import { KIND_LABEL } from '@/lib/data/species'
import { formatCatchMeta } from '@/lib/format'
import { ACH_ICONS } from '@/components/app-shell/icons'
import type { Territory } from '@/lib/data/types'

// Read-only counterpart to ProfileScreen — someone else's territories/catches/
// achievements, plus a follow button instead of edit/sign-out controls. See
// DECISIONS.md: territories/catches for this user come from data FishZoneApp
// already has loaded (filtered by ownerId/userId), not new fetches, except the
// user's own catches (useCatchesByUser) which aren't in any existing list.
export function UserProfileScreen({
  userId,
  territories,
  onBack,
  onOpenTerritory,
  onOpenPhoto,
}: {
  userId: string
  territories: Territory[]
  onBack: () => void
  onOpenTerritory: (id: string) => void
  onOpenPhoto: (src: string) => void
}) {
  const { data: profile } = useProfile(userId)
  const { data: catches = [] } = useCatchesByUser(userId)
  const { data: isFollowing, isLoading: followLoading } = useIsFollowing(userId)
  const setFollowing = useSetFollowing()

  const speciesCount = new Set(catches.map((c) => c.species)).size
  const record = personalRecord(catches)
  const achievements = computeAchievements(catches, territories)
  const recent = catches.slice(0, 3)
  const initials = (profile?.displayName ?? 'Рыбак').slice(0, 2).toUpperCase()

  return (
    <>
      <div className="header-row">
        <div className="icon-btn tap-scale" onClick={onBack}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </div>
        <div style={{ fontWeight: 800, fontSize: 15 }}>Профиль</div>
        <div style={{ width: 36 }} />
      </div>
      <div className="screen-inner">
        <div className="profile-avatar">
          {profile?.avatarUrl ? (
            <img src={profile.avatarUrl} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            initials
          )}
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 19, fontWeight: 800 }}>{profile?.displayName ?? '…'}</div>
          <div style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginTop: 2 }}>{profile?.location ?? 'Аджария, Грузия'}</div>
        </div>

        <div style={{ marginTop: 16 }}>
          <button
            className={isFollowing ? 'btn-secondary' : 'btn-primary'}
            disabled={followLoading || setFollowing.isPending}
            onClick={() => setFollowing.mutate({ followeeId: userId, following: !isFollowing })}
          >
            {isFollowing ? 'Отписаться' : 'Подписаться'}
          </button>
        </div>

        <div className="card stat-grid4" style={{ marginTop: 20, padding: '16px 8px' }}>
          <div>
            <div className="stat-num">{territories.length}</div>
            <div className="stat-label">Территорий</div>
          </div>
          <div>
            <div className="stat-num">{catches.length}</div>
            <div className="stat-label">Уловов</div>
          </div>
          <div>
            <div className="stat-num">{speciesCount}</div>
            <div className="stat-label">Видов рыб</div>
          </div>
          <div>
            <div className="stat-num">{profile?.followersCount ?? 0}</div>
            <div className="stat-label">Подписчика</div>
          </div>
        </div>

        <div className="section-title" style={{ marginTop: 24 }}>
          Достижения
        </div>
        <div className="ach-grid">
          {achievements.map((a) => (
            <div className={`ach-card${a.unlocked ? '' : ' locked'}`} key={a.icon}>
              <div className={`ach-icon ${a.unlocked ? 'on' : 'off'}`}>{ACH_ICONS[a.icon]}</div>
              <div>
                <div className="ach-title">{a.title}</div>
                <div className="ach-desc">{a.desc}</div>
                {!a.unlocked && a.progress && <div className="ach-progress">{a.progress}</div>}
              </div>
            </div>
          ))}
        </div>

        <div className="section-title" style={{ marginTop: 24 }}>
          Последние уловы
        </div>
        <div className="card" style={{ overflow: 'hidden' }}>
          {recent.length ? (
            recent.map((c, i) => {
              const meta = formatCatchMeta(c.lengthCm, c.weightKg)
              return (
                <div
                  key={c.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: i < recent.length - 1 ? '1px solid var(--line)' : 'none' }}
                >
                  <div className="fish-thumb" style={{ width: 46, height: 46, cursor: 'pointer' }} onClick={() => onOpenPhoto(c.photoUrl)}>
                    <img src={c.photoUrl} alt={c.speciesName} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14.5 }}>{c.speciesName}</div>
                    {meta && <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 1 }}>{meta}</div>}
                  </div>
                </div>
              )
            })
          ) : (
            <div style={{ padding: '22px 14px', textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5 }}>Пока нет уловов</div>
          )}
        </div>

        <div className="section-title" style={{ marginTop: 24 }}>
          Территории
        </div>
        <div className="card" style={{ overflow: 'hidden' }}>
          {territories.length ? (
            territories.map((t, i) => (
              <button
                key={t.id}
                className="terr-list-item"
                style={{ borderBottom: i < territories.length - 1 ? '1px solid var(--line)' : 'none' }}
                onClick={() => onOpenTerritory(t.id)}
              >
                <div style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--blue)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5 }}>{t.id}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2 }}>{KIND_LABEL[t.kind]}</div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A8A9AE" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </button>
            ))
          ) : (
            <div style={{ padding: '22px 14px', textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5 }}>Пока нет территорий</div>
          )}
        </div>

        {record && (
          <>
            <div className="section-title" style={{ marginTop: 24 }}>
              Личный рекорд
            </div>
            <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
              <div className="fish-thumb" style={{ width: 52, height: 52, cursor: 'pointer' }} onClick={() => onOpenPhoto(record.photoUrl)}>
                <img src={record.photoUrl} alt={record.speciesName} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{record.speciesName}</div>
                <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 700, marginTop: 2 }}>{record.lengthCm} см</div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
