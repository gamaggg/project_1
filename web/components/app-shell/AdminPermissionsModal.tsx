'use client'

import { useEffect, useState } from 'react'
import { useProfile, useAdminPermissions, useSetAdminPermissions } from '@/lib/supabase/queries'
import type { AdminPermissions } from '@/lib/data/types'

const PERMISSIONS: { key: keyof Omit<AdminPermissions, 'isAdmin'>; label: string }[] = [
  { key: 'canModerateReports', label: 'Модерация жалоб на фото' },
  { key: 'canBlockUsers', label: 'Блокировка пользователей' },
  { key: 'canAddCatchManually', label: 'Добавление улова без геолокации' },
  { key: 'canViewAllUsers', label: 'Список «Все пользователи»' },
]

const EMPTY_PERMS = { canModerateReports: false, canBlockUsers: false, canAddCatchManually: false, canViewAllUsers: false }

// Rendered by FishZoneApp itself, not nested inside a screen's scrolling
// `.screen-inner` — same reason as EditProfileModal/ChangeColorModal (a
// position:absolute overlay inside a scrolled container inherits its scroll
// offset). Reused from two places: UserProfileScreen's "Выдать права
// админа"/"Права администратора" button, and AdminAccessScreen's "Доступы"
// list (tapping an admin row) — both just pass the target userId.
export function AdminPermissionsModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { data: profile } = useProfile(userId)
  const { data: perms } = useAdminPermissions(userId)
  const setPerms = useSetAdminPermissions()
  const [toggles, setToggles] = useState(EMPTY_PERMS)

  // Pre-fill from the real (unmasked) permission set once it loads — a fresh
  // grant (profile isn't an admin yet) has nothing to prefill, so it just
  // keeps everything off until the super admin picks what to grant.
  useEffect(() => {
    if (perms) setToggles({ canModerateReports: perms.canModerateReports, canBlockUsers: perms.canBlockUsers, canAddCatchManually: perms.canAddCatchManually, canViewAllUsers: perms.canViewAllUsers })
  }, [perms])

  const isNewGrant = !profile?.isAdmin

  async function handleSave() {
    await setPerms.mutateAsync({ userId, isAdmin: true, ...toggles })
    onClose()
  }

  async function handleRevoke() {
    await setPerms.mutateAsync({ userId, isAdmin: false, ...EMPTY_PERMS })
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
          {isNewGrant ? 'Выдать права админа' : 'Права администратора'}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
          <div className="owner-avatar">{profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : initials}</div>
          <div style={{ fontWeight: 700, fontSize: 14.5 }}>{profile?.displayName ?? '…'}</div>
        </div>

        <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.3px', marginTop: 20 }}>
          Этому админу разрешено
        </div>
        <div>
          {PERMISSIONS.map((p) => (
            <div key={p.key} className="perm-switch-row">
              <div className="perm-switch-label">{p.label}</div>
              <button
                type="button"
                className={`perm-switch${toggles[p.key] ? ' on' : ''}`}
                aria-label={p.label}
                aria-pressed={toggles[p.key]}
                onClick={() => setToggles((t) => ({ ...t, [p.key]: !t[p.key] }))}
              />
            </div>
          ))}
        </div>

        <button className="btn-primary" style={{ marginTop: 18 }} onClick={handleSave} disabled={setPerms.isPending}>
          {setPerms.isPending ? 'Сохраняем…' : isNewGrant ? 'Выдать права' : 'Сохранить'}
        </button>
        {!isNewGrant && (
          <button className="btn-secondary" style={{ marginTop: 10, color: '#D33' }} onClick={handleRevoke} disabled={setPerms.isPending}>
            Забрать права администратора
          </button>
        )}
      </div>
    </div>
  )
}
