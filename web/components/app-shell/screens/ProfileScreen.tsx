'use client'

import { useState } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useProfile, useMyCatches, useUpdateProfile, useIsAdmin, useIsSuperAdmin, useReports, useHasClaimedFromOthers } from '@/lib/supabase/queries'
import { uploadAvatar } from '@/lib/supabase/storage'
import { computeAchievements, personalRecord, type Achievement } from '@/lib/data/achievements'
import { KIND_LABEL } from '@/lib/data/species'
import { formatCatchMeta } from '@/lib/format'
import { ACH_ICONS } from '@/components/app-shell/icons'
import { AuthForm } from '@/components/app-shell/AuthForm'
import type { Territory } from '@/lib/data/types'

const MAX_AVATAR_SIZE = 512

// Downscales a picked image file to a square-ish JPEG before upload — avatars
// don't need full-resolution phone photos (same spirit as the 1280px catch-photo
// cap in CameraScreen, just smaller since this is a tiny thumbnail everywhere).
function downscaleImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, MAX_AVATAR_SIZE / Math.max(img.naturalWidth, img.naturalHeight))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.naturalWidth * scale)
      canvas.height = Math.round(img.naturalHeight * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('no canvas context'))
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.85)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image load failed'))
    }
    img.src = url
  })
}

// Rendered by FishZoneApp itself, not nested inside this screen's scrolling
// `.screen-inner` — a position:absolute overlay nested inside a scrolled
// container inherits that scroll offset (see DECISIONS.md, same bug as
// PhotoLightbox). Exported so FishZoneApp can mount it at the app-shell level.
export function EditProfileModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const { data: profile } = useProfile(user?.id ?? null)
  const updateProfile = useUpdateProfile()
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl ?? null)
  const [avatarStatus, setAvatarStatus] = useState<'idle' | 'uploading' | 'error'>('idle')

  async function handleAvatarPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !user) return
    setAvatarStatus('uploading')
    try {
      const blob = await downscaleImage(file)
      const url = await uploadAvatar(user.id, blob)
      await updateProfile.mutateAsync({ avatarUrl: url })
      setAvatarUrl(url)
      setAvatarStatus('idle')
    } catch {
      setAvatarStatus('error')
    }
  }

  async function handleSave() {
    const trimmed = displayName.trim()
    if (!trimmed) return
    await updateProfile.mutateAsync({ displayName: trimmed, bio: bio.trim() || null })
    onClose()
  }

  const initials = (profile?.displayName ?? 'Рыбак').slice(0, 2).toUpperCase()

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-card-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-close tap-scale" onClick={onClose}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.4" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </div>
        <div className="modal-title" style={{ textAlign: 'center' }}>
          Редактировать профиль
        </div>

        <div className="avatar-edit-wrap" style={{ marginTop: 18 }}>
          <div className="profile-avatar">
            {avatarStatus === 'uploading' ? (
              <div className="spinner" />
            ) : avatarUrl ? (
              <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              initials
            )}
          </div>
          <label className="avatar-edit-btn tap-scale">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <input type="file" accept="image/*" onChange={handleAvatarPick} style={{ display: 'none' }} />
          </label>
        </div>
        {avatarStatus === 'error' && (
          <div style={{ textAlign: 'center', color: '#D33', fontSize: 12.5, marginTop: -8, marginBottom: 10 }}>
            Не удалось загрузить фото, попробуй ещё раз
          </div>
        )}

        <div className="auth-field" style={{ marginTop: 8 }}>
          <label htmlFor="edit-name">Имя</label>
          <input id="edit-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} />
        </div>

        <div className="auth-field">
          <label htmlFor="edit-bio">О себе</label>
          <textarea
            id="edit-bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={280}
            rows={3}
            placeholder="Необязательно"
            style={{ resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>

        <div className="auth-field">
          <label>Email</label>
          <input value={user?.email ?? ''} disabled />
          <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 4 }}>Email нельзя изменить</div>
        </div>

        <button className="btn-primary" style={{ marginTop: 6 }} onClick={handleSave} disabled={!displayName.trim() || updateProfile.isPending}>
          {updateProfile.isPending ? 'Сохраняем…' : 'Сохранить'}
        </button>
      </div>
    </div>
  )
}

export function ProfileScreen({
  myTerritories,
  allTerritories,
  onOpenTerritory,
  onSignOut,
  onEditProfile,
  onOpenPhoto,
  onOpenReports,
  onOpenAdminAccess,
  onOpenAdminLog,
  onOpenAchievements,
  onOpenAchievementDetail,
}: {
  myTerritories: Territory[]
  allTerritories: Territory[]
  onOpenTerritory: (id: string) => void
  onSignOut: () => void
  onEditProfile: () => void
  onOpenPhoto: (src: string) => void
  onOpenReports: () => void
  onOpenAdminAccess: () => void
  onOpenAdminLog: () => void
  onOpenAchievements: () => void
  onOpenAchievementDetail: (icon: Achievement['icon']) => void
}) {
  const { user } = useAuth()
  const { data: profile } = useProfile(user?.id ?? null)
  const { data: myCatches = [] } = useMyCatches()
  const isAdmin = useIsAdmin()
  const isSuperAdmin = useIsSuperAdmin()
  const { data: reports = [] } = useReports()
  const { data: claimedFromOthers = false } = useHasClaimedFromOthers(user?.id ?? null)

  // Signed out: the profile tab IS the sign-in/sign-up entry point (see
  // DECISIONS.md — replaced the standalone /auth redirect from the "+" button).
  // Signing in here updates AuthProvider's `user` reactively, which swaps this
  // form out for the real profile below without any navigation.
  if (!user) {
    return (
      <div className="screen-inner">
        <AuthForm />
      </div>
    )
  }

  const speciesCount = new Set(myCatches.map((c) => c.species)).size
  const record = personalRecord(myCatches)
  const achievements = computeAchievements(myCatches, {
    myTerritories,
    allTerritories,
    followersCount: profile?.followersCount ?? 0,
    claimedFromOthers,
  })
  const recentMine = myCatches.slice(0, 3)
  const initials = (profile?.displayName ?? 'Рыбак').slice(0, 2).toUpperCase()

  return (
    <div className="screen-inner">
      <div className="page-title" style={{ textAlign: 'center', marginTop: 14, marginBottom: 16 }}>
        Профиль
      </div>
      <div className="avatar-edit-wrap">
        <div className="profile-avatar">
          {profile?.avatarUrl ? (
            <img src={profile.avatarUrl} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            initials
          )}
        </div>
        <div className="avatar-edit-btn tap-scale" onClick={onEditProfile}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
          </svg>
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 19, fontWeight: 800 }}>{profile?.displayName ?? '…'}</div>
        <div style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginTop: 2 }}>{profile?.location ?? 'Батуми, Грузия'}</div>
        {profile?.publicId && (
          <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 4, fontWeight: 700, letterSpacing: 0.4 }}>ID: {profile.publicId}</div>
        )}
        {profile?.bio && (
          <div style={{ fontSize: 13.5, color: 'var(--ink)', marginTop: 8, lineHeight: 1.4 }}>{profile.bio}</div>
        )}
      </div>
      <div className="card stat-grid4" style={{ marginTop: 20, padding: '16px 8px' }}>
        <div>
          <div className="stat-num">{myTerritories.length}</div>
          <div className="stat-label">Территорий</div>
        </div>
        <div>
          <div className="stat-num">{myCatches.length}</div>
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
        {achievements.slice(0, 4).map((a) => (
          <div className={`ach-card${a.unlocked ? '' : ' locked'}`} key={a.icon} onClick={() => onOpenAchievementDetail(a.icon)}>
            <div className={`ach-icon ${a.unlocked ? 'on' : 'off'}`}>{ACH_ICONS[a.icon]}</div>
            <div>
              <div className="ach-title">{a.title}</div>
              <div className="ach-desc">{a.desc}</div>
              {!a.unlocked && a.progress && <div className="ach-progress">{a.progress}</div>}
            </div>
          </div>
        ))}
      </div>
      <button className="btn-secondary" style={{ marginTop: 12 }} onClick={onOpenAchievements}>
        Все достижения
      </button>

      <div className="section-title" style={{ marginTop: 24 }}>
        Последние уловы
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        {recentMine.length ? (
          recentMine.map((c, i) => {
            const meta = formatCatchMeta(c.lengthCm, c.weightKg)
            return (
              <div
                key={c.id}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: i < recentMine.length - 1 ? '1px solid var(--line)' : 'none' }}
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
        Мои территории
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        {myTerritories.length ? (
          myTerritories.map((t, i) => (
            <button
              key={t.id}
              className="terr-list-item"
              style={{ borderBottom: i < myTerritories.length - 1 ? '1px solid var(--line)' : 'none' }}
              onClick={() => onOpenTerritory(t.id)}
            >
              <div style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--green)' }} />
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
          <div style={{ padding: '22px 14px', textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5 }}>Пока нет своих территорий</div>
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

      {isAdmin && (
        <div className="btn-wrap" style={{ marginTop: 24 }}>
          <button className="btn-secondary" onClick={onOpenReports}>
            Жалобы на фото
          </button>
          {reports.length > 0 && <span className="btn-badge">{reports.length}</span>}
        </div>
      )}
      {isSuperAdmin && (
        <>
          <div style={{ marginTop: 12 }}>
            <button className="btn-secondary" onClick={onOpenAdminAccess}>
              Доступы
            </button>
          </div>
          <div style={{ marginTop: 12 }}>
            <button className="btn-secondary" onClick={onOpenAdminLog}>
              Последние действия
            </button>
          </div>
        </>
      )}

      <div style={{ marginTop: isAdmin ? 12 : 24 }}>
        <button className="btn-secondary" onClick={onSignOut}>
          Выйти
        </button>
      </div>
    </div>
  )
}
