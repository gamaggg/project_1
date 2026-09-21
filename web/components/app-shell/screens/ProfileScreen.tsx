'use client'

import { useState, type CSSProperties } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { createClient } from '@/lib/supabase/client'
import {
  useProfile,
  useMyCatches,
  useUpdateProfile,
  useCanModerateReports,
  useIsSuperAdmin,
  useReports,
  useHasClaimedFromOthers,
  useUserAwards,
  useFollowers,
  useTelegramNotificationState,
  useSetTelegramNotifications,
  useCreateTelegramLink,
} from '@/lib/supabase/queries'
import { AwardsRing } from '@/components/app-shell/AwardsRing'
import { uploadAvatar } from '@/lib/supabase/storage'
import { computeAchievements, personalRecord, type Achievement } from '@/lib/data/achievements'
import { KIND_LABEL } from '@/lib/data/species'
import { formatCatchMeta, formatJoinedDate, pluralCatches, pluralFollowers, pluralSpecies, pluralTerritories, speciesBreakdown, type SpeciesEntry } from '@/lib/format'
import { ACH_ICONS, CTA_ICONS } from '@/components/app-shell/icons'
import { TerritoryColorPreviewMap } from '@/components/app-shell/TerritoryColorPreviewMap'
import { DEFAULT_TERRITORY_COLOR, TERRITORY_COLORS } from '@/lib/data/territoryColors'
import { resolveHeroBackground } from '@/lib/data/heroBackgrounds'
import { resolveAvatarFrame } from '@/lib/data/shopItems'
import { StyledName } from '@/components/app-shell/StyledName'
import { CoinIcon } from '@/components/app-shell/CoinIcon'
import { HeroBgLive } from '@/components/app-shell/HeroBgLive'
import { CITIES, type CityId } from '@/lib/data/city'
import type { Territory, UserAward, ProfileSummary } from '@/lib/data/types'
import { useMagneticProfileHero } from '@/lib/useMagneticProfileHero'
import { useTelegramHomeScreen } from '@/lib/telegram/useTelegramHomeScreen'

// Telegram notifications, as one row rather than a screen of its own —
// there's a single setting to make so far. Which control it shows depends on
// whether the bot is actually able to reach this person: being signed in
// through Telegram isn't enough, a bot may only write to someone who has
// opened a chat with it first.
function TelegramNotificationsRow() {
  const { data: state } = useTelegramNotificationState()
  const setEnabled = useSetTelegramNotifications()
  const createLink = useCreateTelegramLink()
  const [linkError, setLinkError] = useState(false)

  if (!state) return null

  const reachable = state.linked && state.botStarted && !state.unreachable

  if (reachable) {
    return (
      <div className="perm-switch-row" style={{ borderBottom: 'none', padding: 0 }}>
        <div className="perm-switch-label">Уведомления в Telegram</div>
        <button
          className={`perm-switch${state.enabled ? ' on' : ''}`}
          aria-label="Уведомления в Telegram"
          disabled={setEnabled.isPending}
          onClick={() => setEnabled.mutate(!state.enabled)}
        />
      </div>
    )
  }

  async function connect() {
    setLinkError(false)
    try {
      const url = await createLink.mutateAsync()
      // Inside the Mini App this hands off to Telegram itself; in a plain
      // browser the t.me link opens the app (or its web version).
      const webApp = window.Telegram?.WebApp
      if (webApp?.openTelegramLink) webApp.openTelegramLink(url)
      else window.open(url, '_blank', 'noopener')
    } catch {
      setLinkError(true)
    }
  }

  return (
    <>
      <button className="btn-secondary" disabled={createLink.isPending} onClick={connect}>
        {state.unreachable ? 'Подключить Telegram заново' : 'Подключить уведомления в Telegram'}
      </button>
      {linkError && (
        <div style={{ fontSize: 12.5, color: '#D33', marginTop: 6 }}>Не получилось создать ссылку. Попробуй ещё раз.</div>
      )}
    </>
  )
}

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

// Standalone modal, same reasoning as the coin-history button in
// GrantCoinsModal — a security-sensitive action with its own validation/submit
// state gets its own layer rather than expanding inline. No "current
// password" field: this app's only other password-set flow (ForgotPasswordFlow,
// after OTP verification) doesn't ask for one either, and Supabase's
// updateUser() doesn't require it for an already-authenticated session.
function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const mismatch = passwordConfirm.length > 0 && password !== passwordConfirm
  const valid = password.length >= 6 && passwordConfirm.length >= 6 && !mismatch

  async function handleSubmit() {
    if (!valid) return
    setError(null)
    setPending(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    setPending(false)
    if (error) setError(error.message)
    else setDone(true)
  }

  return (
    <div className="modal-overlay" onClick={pending ? undefined : onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Изменить пароль</div>
        {done ? (
          <>
            <div style={{ marginTop: 10, fontSize: 13.5, color: 'var(--ink-soft)' }}>Пароль обновлён.</div>
            <button className="btn-primary" style={{ marginTop: 14 }} onClick={onClose}>
              Готово
            </button>
          </>
        ) : (
          <>
            <div className="auth-field" style={{ marginTop: 12 }}>
              <label htmlFor="change-password-new">Новый пароль</label>
              <input
                id="change-password-new"
                type="password"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Минимум 6 символов"
              />
            </div>
            <div className="auth-field">
              <label htmlFor="change-password-confirm">Повторите пароль</label>
              <input
                id="change-password-confirm"
                type="password"
                minLength={6}
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder="Ещё раз пароль"
              />
              {mismatch && <div style={{ fontSize: 12.5, color: '#D33', marginTop: 4 }}>Пароли не совпадают</div>}
            </div>
            {error && (
              <div style={{ color: '#D33', fontSize: 12.5, fontWeight: 600, marginTop: 4 }}>{error}</div>
            )}
            <button className="btn-primary" style={{ marginTop: 10 }} disabled={!valid || pending} onClick={handleSubmit}>
              {pending ? 'Сохраняем…' : 'Сохранить пароль'}
            </button>
            <button className="btn-secondary" style={{ marginTop: 8 }} disabled={pending} onClick={onClose}>
              Отмена
            </button>
          </>
        )}
      </div>
    </div>
  )
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
  const [changingPassword, setChangingPassword] = useState(false)

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
        <button className="btn-secondary" style={{ marginTop: 8 }} onClick={() => setChangingPassword(true)}>
          Изменить пароль
        </button>
      </div>
      {changingPassword && <ChangePasswordModal onClose={() => setChangingPassword(false)} />}
    </div>
  )
}

// Same app-shell-level mounting as EditProfileModal, same reason (scroll
// offset). Live preview centers on that city's colorPreviewCenter (a real,
// recognizably busy landmark — see city.ts) rather than the viewer's own
// first sector, which could be anywhere or not exist yet for a brand-new
// account with zero territories. Profile background used to live behind a
// menu step here too, but it's now chosen from the Shop (where all
// backgrounds live and show their live animation) — this modal is territory
// color only, so the avatar's palette icon opens straight to it.
export function ChangeColorModal({ onClose, city }: { onClose: () => void; city: CityId }) {
  const { user } = useAuth()
  const { data: profile } = useProfile(user?.id ?? null)
  const updateProfile = useUpdateProfile()
  const [selected, setSelected] = useState<string | null>(profile?.territoryColor ?? null)

  async function handleSaveColor() {
    if (!selected) return
    await updateProfile.mutateAsync({ territoryColor: selected })
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-card-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-close tap-scale" onClick={onClose}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.4" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </div>

        <div className="modal-title" style={{ textAlign: 'center' }}>
          Цвет территории
        </div>
        <TerritoryColorPreviewMap
          city={city}
          myTerritoryColor={selected ?? profile?.territoryColor ?? DEFAULT_TERRITORY_COLOR}
          equippedSkin={profile?.equippedSkin}
        />
        <div className="color-row">
          {TERRITORY_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`color-swatch${selected === c.hex ? ' selected' : ''}`}
              style={{ '--swatch-color': c.hex } as CSSProperties}
              aria-label={c.label}
              onClick={() => setSelected(c.hex)}
            />
          ))}
        </div>
        <button className="btn-primary" onClick={handleSaveColor} disabled={!selected || updateProfile.isPending}>
          {updateProfile.isPending ? 'Сохраняем…' : 'Сохранить'}
        </button>
      </div>
    </div>
  )
}

export function ProfileScreen({
  myTerritories,
  allTerritories,
  city,
  onOpenTerritory,
  onOpenAllTerritories,
  onOpenAllCatches,
  onSignOut,
  onEditProfile,
  onChangeColor,
  onLinkEmail,
  onOpenCityPicker,
  onOpenPhoto,
  onOpenReports,
  onOpenAdminAccess,
  onOpenAdminLog,
  adminLogUnreadCount,
  onOpenAchievements,
  onOpenAchievementDetail,
  onOpenAward,
  onShareProfile,
  onOpenFollowers,
  onOpenSpecies,
  onPostAnnouncement,
  onEditPublicId,
  onGrantCoins,
  onOpenShop,
  onOpenChallenges,
}: {
  myTerritories: Territory[]
  allTerritories: Territory[]
  city: CityId
  onOpenTerritory: (id: string) => void
  onOpenAllTerritories: () => void
  onOpenAllCatches: () => void
  onSignOut: () => void
  onEditProfile: () => void
  onChangeColor: () => void
  onLinkEmail: () => void
  onOpenCityPicker: () => void
  onOpenPhoto: (catchId: number) => void
  onOpenReports: () => void
  onOpenAdminAccess: () => void
  onOpenAdminLog: () => void
  adminLogUnreadCount: number
  onOpenAchievements: () => void
  onOpenAchievementDetail: (icon: Achievement['icon']) => void
  onOpenAward: (award: UserAward) => void
  onShareProfile: (publicId: string, text: string) => void
  onOpenFollowers: (people: ProfileSummary[]) => void
  onOpenSpecies: (species: SpeciesEntry[]) => void
  onPostAnnouncement: () => void
  onEditPublicId: (id: string) => void
  onGrantCoins: (id: string) => void
  onOpenShop: () => void
  onOpenChallenges: () => void
}) {
  const { user } = useAuth()
  const { data: profile } = useProfile(user?.id ?? null)
  const { data: myCatches = [] } = useMyCatches()
  const canModerateReports = useCanModerateReports()
  const isSuperAdmin = useIsSuperAdmin()
  const { data: reports = [] } = useReports()
  const { data: claimedFromOthers = false } = useHasClaimedFromOthers(user?.id ?? null)
  const { data: awards = [] } = useUserAwards(user?.id ?? null)
  const { data: followers = [] } = useFollowers(user?.id ?? null)
  const equippedFrame = resolveAvatarFrame(profile?.equippedFrame)

  // `!user` never reaches this screen anymore — FishZoneApp's onboarding gate
  // intercepts before ProfileScreen (or any other screen) can mount. See
  // DECISIONS.md.
  const heroRef = useMagneticProfileHero()
  const mySpecies = speciesBreakdown(myCatches)
  const speciesCount = mySpecies.length
  const record = personalRecord(myCatches)
  const achievements = computeAchievements(
    myCatches,
    {
      myTerritories,
      allTerritories,
      followersCount: profile?.followersCount ?? 0,
      claimedFromOthers,
    },
    city
  )
  const recentMine = myCatches.slice(0, 3)
  const visibleTerritories = myTerritories.slice(0, 5)
  const initials = (profile?.displayName ?? 'Рыбак').slice(0, 2).toUpperCase()
  // Synthetic placeholder set by the Telegram auto-sign-in handshake (see
  // api/auth/telegram/route.ts) — never a real address the person chose, so
  // offering "Link email" only makes sense while it's still this pattern.
  const isTelegramAccount = user?.email?.endsWith('@telegram.catchrange.com') ?? false
  const { status: homeScreenStatus, promptAdd: promptAddToHomeScreen } = useTelegramHomeScreen()
  const showAddToHomeScreen = homeScreenStatus === 'unknown' || homeScreenStatus === 'missed'

  function handleShareProfile() {
    if (!profile?.publicId) return
    const text = `🎣 Я в RANGE — ${myTerritories.length} ${pluralTerritories(myTerritories.length)}, ${myCatches.length} ${pluralCatches(myCatches.length)}!\n\nПрисоединяйся и сразимся за территории 🏆`
    onShareProfile(profile.publicId, text)
  }

  return (
    <div className="screen-inner">
      <div
        className="profile-hero"
        ref={heroRef}
        style={
          {
            background: resolveHeroBackground(profile?.heroBg).base,
            '--hero-accent-rgb': resolveHeroBackground(profile?.heroBg).accentRgb,
            '--hero-text-rgb': resolveHeroBackground(profile?.heroBg).textRgb ?? '255,255,255',
          } as CSSProperties
        }
      >
        <HeroBgLive bg={resolveHeroBackground(profile?.heroBg)} variant="hero" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
          <button className="coin-pill tap-scale" onClick={onOpenShop}>
            <CoinIcon size={16} className="coin-pill-icon" />
            {profile?.coins ?? 0}
          </button>
          <div className="icon-btn tap-scale" onClick={handleShareProfile}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 15V4M12 4 8 8M12 4l4 4" />
              <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
            </svg>
          </div>
        </div>
        <AwardsRing awards={awards} onOpenAward={onOpenAward}>
          <div className="profile-hero-avatar-ring">
            {equippedFrame && (
              <div className={`avatar-frame-ring${equippedFrame.glow ? ' avatar-frame-glow' : ''}`} style={{ background: equippedFrame.ring }} />
            )}
            <div className="avatar-edit-wrap">
              <div className="profile-avatar">
                {profile?.avatarUrl ? (
                  <img src={profile.avatarUrl} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  initials
                )}
              </div>
              <div className="avatar-color-btn tap-scale" onClick={onChangeColor}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-.5-1.5-1-2 .5-2 2-2h2a3 3 0 0 0 3-3 9 9 0 0 0-8-9z" />
                  <circle cx="7.5" cy="10.5" r="1" fill="#fff" stroke="none" />
                  <circle cx="12" cy="7.5" r="1" fill="#fff" stroke="none" />
                  <circle cx="16.5" cy="10.5" r="1" fill="#fff" stroke="none" />
                </svg>
              </div>
              <div className="avatar-edit-btn tap-scale" onClick={onEditProfile}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                </svg>
              </div>
            </div>
          </div>
        </AwardsRing>
        <div className="profile-hero-name">
          <StyledName name={profile?.displayName ?? 'Профиль'} styleId={profile?.equippedNameStyle} />
        </div>
        <div className="profile-hero-meta">
          {profile?.createdAt && <>В RANGE с <b>{formatJoinedDate(profile.createdAt)}</b></>}
          {profile?.publicId && <> · ID {profile.publicId}</>}
        </div>
        <div className="profile-hero-badge">
          <button
            className="section-link"
            style={{ color: 'rgba(var(--hero-text-rgb,255,255,255),.75)', display: 'inline-flex', alignItems: 'center', gap: 5 }}
            onClick={onOpenCityPicker}
          >
            Город: {CITIES[city].name}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
            </svg>
          </button>
        </div>
        {profile?.bio && (
          <div style={{ fontSize: 13.5, color: 'rgba(var(--hero-text-rgb,255,255,255),.85)', marginTop: 10, lineHeight: 1.4, textAlign: 'center' }}>{profile.bio}</div>
        )}
      </div>
      <div className="profile-body">
      <div className="hero-stat-grid">
        <button className="hero-stat" onClick={onOpenAllTerritories}>
          <b>{myTerritories.length}</b>
          <span>{pluralTerritories(myTerritories.length)}</span>
        </button>
        <button className="hero-stat" onClick={onOpenAllCatches}>
          <b>{myCatches.length}</b>
          <span>{pluralCatches(myCatches.length)}</span>
        </button>
        <button className="hero-stat" onClick={() => onOpenSpecies(mySpecies)}>
          <b>{speciesCount}</b>
          <span>{pluralSpecies(speciesCount)} рыб</span>
        </button>
        <button
          className="hero-stat"
          onClick={() => (profile?.followersCount ?? 0) > 0 && onOpenFollowers(followers)}
        >
          <b>{profile?.followersCount ?? 0}</b>
          <span>{pluralFollowers(profile?.followersCount ?? 0)}</span>
        </button>
      </div>

      <div className="profile-cta-row" style={{ marginTop: 24 }}>
        <button className="profile-cta-btn profile-cta-challenges tap-scale" onClick={onOpenChallenges}>
          <div className="profile-cta-pattern" />
          <span className="profile-cta-arrow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </span>
          <span className="profile-cta-icon">{CTA_ICONS.target}</span>
          <span className="profile-cta-title">Челленджи недели</span>
          <span className="profile-cta-sub">Выполняй и получай награды</span>
        </button>
        <button className="profile-cta-btn profile-cta-shop tap-scale" onClick={onOpenShop}>
          <div className="profile-cta-pattern" />
          <span className="profile-cta-arrow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </span>
          <span className="profile-cta-icon">{CTA_ICONS.bag}</span>
          <span className="profile-cta-title">Магазин</span>
          <span className="profile-cta-sub">Рамки, фоны, скины</span>
        </button>
      </div>

      <div className="section-title-row" style={{ marginTop: 24 }}>
        <div className="section-title">Достижения</div>
        <button className="section-link" onClick={onOpenAchievements}>
          Все достижения
        </button>
      </div>
      <div className="ach-grid">
        {achievements.slice(0, 4).map((a, i) => (
          <div
            className={`ach-card${a.unlocked ? '' : ' locked'}`}
            key={a.icon}
            onClick={() => onOpenAchievementDetail(a.icon)}
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className={`ach-icon hex-aspect hex-shape ${a.unlocked ? 'on' : 'off'}`}>{ACH_ICONS[a.icon]}</div>
            <div>
              <div className="ach-title">{a.title}</div>
              <div className="ach-desc">{a.desc}</div>
              {!a.unlocked && a.progress && <div className="ach-progress">{a.progress}</div>}
            </div>
          </div>
        ))}
      </div>

      <div className="section-title-row" style={{ marginTop: 24 }}>
        <div className="section-title">Последние уловы</div>
        {myCatches.length > recentMine.length && (
          <button className="section-link" onClick={onOpenAllCatches}>
            Все уловы
          </button>
        )}
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        {recentMine.length ? (
          recentMine.map((c, i) => {
            const meta = formatCatchMeta(c.lengthCm, c.weightKg)
            return (
              <div
                key={c.id}
                className="tap-scale"
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: i < recentMine.length - 1 ? '1px solid var(--line)' : 'none', cursor: 'pointer' }}
                onClick={() => onOpenPhoto(c.id)}
              >
                <div className="fish-thumb" style={{ width: 46, height: 46 }}>
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

      <div className="section-title-row" style={{ marginTop: 24 }}>
        <div className="section-title">Мои территории</div>
        {myTerritories.length > visibleTerritories.length && (
          <button className="section-link" onClick={onOpenAllTerritories}>
            Все мои территории
          </button>
        )}
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        {visibleTerritories.length ? (
          visibleTerritories.map((t, i) => (
            <button
              key={t.id}
              className="terr-list-item"
              style={{ borderBottom: i < visibleTerritories.length - 1 ? '1px solid var(--line)' : 'none' }}
              onClick={() => onOpenTerritory(t.id)}
            >
              <div
                className="hex-aspect hex-shape"
                style={{ width: 12, background: profile?.territoryColor ?? DEFAULT_TERRITORY_COLOR, flex: '0 0 auto', alignSelf: 'flex-start', marginTop: 4 }}
              />
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
          <div className="card tap-scale" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }} onClick={() => onOpenPhoto(record.id)}>
            <div className="fish-thumb" style={{ width: 52, height: 52 }}>
              <img src={record.photoUrl} alt={record.speciesName} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{record.speciesName}</div>
              <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 700, marginTop: 2 }}>{record.lengthCm} см</div>
            </div>
          </div>
        </>
      )}

      {canModerateReports && (
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
          <div className="btn-wrap" style={{ marginTop: 12 }}>
            <button className="btn-secondary" onClick={onOpenAdminLog}>
              Последние действия
            </button>
            {adminLogUnreadCount > 0 && <span className="btn-badge">{adminLogUnreadCount}</span>}
          </div>
          <div style={{ marginTop: 12 }}>
            <button className="btn-secondary" onClick={onPostAnnouncement}>
              Написать пост
            </button>
          </div>
          {user && (
            <div style={{ marginTop: 12 }}>
              <button className="btn-secondary" onClick={() => onEditPublicId(user.id)}>
                Изменить ID
              </button>
            </div>
          )}
          {user && (
            <div style={{ marginTop: 12 }}>
              <button className="btn-secondary shop-price-btn" onClick={() => onGrantCoins(user.id)}>
                Монеты: <CoinIcon size={16} /> {profile?.coins ?? 0}
              </button>
            </div>
          )}
        </>
      )}

      <div style={{ marginTop: 12 }}>
        <TelegramNotificationsRow />
      </div>

      {isTelegramAccount && (
        <div style={{ marginTop: 12 }}>
          <button className="btn-secondary" onClick={onLinkEmail}>
            Привязать почту
          </button>
        </div>
      )}

      {showAddToHomeScreen && (
        <div style={{ marginTop: isTelegramAccount || canModerateReports || isSuperAdmin ? 12 : 24 }}>
          <button className="btn-secondary" onClick={promptAddToHomeScreen}>
            Добавить RANGE на главный экран
          </button>
        </div>
      )}

      <div style={{ marginTop: showAddToHomeScreen || isTelegramAccount || canModerateReports || isSuperAdmin ? 12 : 24, paddingBottom: 24 }}>
        <button className="btn-secondary" onClick={onSignOut}>
          Выйти
        </button>
      </div>
      </div>
    </div>
  )
}
