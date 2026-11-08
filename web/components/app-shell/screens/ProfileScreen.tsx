'use client'

import { HexLoader } from '@/components/app-shell/HexLoader'
import { geoImageUrl } from '@/lib/geo'
import { SkeletonRows } from '@/components/app-shell/Skeleton'
import { useShopRewardsCount } from '@/lib/shopRewards'
import { useState, type CSSProperties } from 'react'
import { thumbUrl } from '@/lib/supabase/imageUrl'
import { useAuth } from '@/components/providers/AuthProvider'
import { createClient } from '@/lib/supabase/client'
import {
  useProfile,
  useMyCatches,
  useUpdateProfile,
  useCanModerateReports,
  useCanReviewPanoramas,
  useCanViewLimits,
  useCanViewStats,
  useIsSuperAdmin,
  useReports,
  useHasClaimedFromOthers,
  useEarnedAchievements,
  useUserAwards,
  useFollowers,
  useTelegramNotificationState,
  useSetTelegramNotifications,
  useCreateTelegramLink,
  useClanChatSummary,
  useGeoToday,
} from '@/lib/supabase/queries'
import { AwardsRing, type AwardGroup } from '@/components/app-shell/AwardsRing'
import { uploadAvatar } from '@/lib/supabase/storage'
import { ProfileCatchRow, ProfileTrophies } from '@/components/app-shell/ProfileTrophies'
import { ProfileSectorRow } from '@/components/app-shell/ProfileSectors'
import { AchievementCard } from '@/components/app-shell/AchievementCard'
import { computeAchievements, heldTerritories, trophies, type Achievement } from '@/lib/data/achievements'
import { ClanCrest } from '@/components/app-shell/ClanCrest'
import { resolveClanBackground } from '@/lib/data/clanBackgrounds'
import { CLAN_ROLE_LABEL } from '@/lib/data/clanLevels'
import { formatJoinedDate, pluralCatches, pluralFollowers, pluralTerritories, speciesBreakdown, type SpeciesEntry } from '@/lib/format'
import { CTA_ICONS } from '@/components/app-shell/icons'
import { TerritoryColorPreviewMap } from '@/components/app-shell/TerritoryColorPreviewMap'
import { DEFAULT_TERRITORY_COLOR, TERRITORY_COLORS } from '@/lib/data/territoryColors'
import { resolveHeroBackground } from '@/lib/data/heroBackgrounds'
import { resolveAvatarFrame } from '@/lib/data/shopItems'
import { AvatarFrameRing } from '@/components/app-shell/AvatarFrameRing'
import { StyledName } from '@/components/app-shell/StyledName'
import { CoinIcon } from '@/components/app-shell/CoinIcon'
import { CountUp, LiveCoinBalance } from '@/components/app-shell/CoinCountUp'
import { AdminPanel, ADMIN_ICONS } from '@/components/app-shell/AdminPanel'
import { insideTelegram } from '@/lib/openExternal'
import { HeroBgLive } from '@/components/app-shell/HeroBgLive'
import { CITIES, type CityId } from '@/lib/data/city'
import type { Territory, ProfileSummary } from '@/lib/data/types'
import { useCanInstall } from '@/lib/installApp'
import { InstallAppModal } from '@/components/app-shell/InstallAppModal'
import { useT, TRANSLATION_READY } from '@/lib/i18n'
import { LanguagePicker } from '@/components/app-shell/LanguagePicker'
import { tn } from '@/lib/i18n'
import { Flag } from '@/components/app-shell/Flag'
import { EconomyAdminLazy } from '@/components/clan2/live/lazy'

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

  // The row's shape while the bot's state is asked for, so the settings
  // under it don't jump.
  if (!state) {
    return (
      <div className="perm-switch-row" style={{ borderBottom: 'none', padding: 0 }} aria-busy="true">
        <span className="skel" style={{ width: 170, height: 14 }} />
        <span className="skel" style={{ width: 46, height: 28, borderRadius: 14 }} />
      </div>
    )
  }

  const reachable = state.linked && state.botStarted && !state.unreachable

  if (reachable) {
    return (
      <div className="perm-switch-row" style={{ borderBottom: 'none', padding: 0 }}>
        <div className="perm-switch-label">{tn('profile.tgNotifications')}</div>
        <button
          className={`perm-switch${state.enabled ? ' on' : ''}`}
          aria-label={tn('profile.tgNotifications')}
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
      if (insideTelegram() && webApp?.openTelegramLink) webApp.openTelegramLink(url)
      else window.open(url, '_blank', 'noopener')
    } catch {
      setLinkError(true)
    }
  }

  return (
    <>
      <button className="btn-secondary" disabled={createLink.isPending} onClick={connect}>
        {state.unreachable ? tn('profile.tgReconnect') : tn('profile.tgConnect')}
      </button>
      {linkError && (
        <div style={{ fontSize: 12.5, color: '#D33', marginTop: 6 }}>{tn('profile.tgLinkFailed')}</div>
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
        <div className="modal-title">{tn('profile.changePassword')}</div>
        {done ? (
          <>
            <div style={{ marginTop: 10, fontSize: 13.5, color: 'var(--ink-soft)' }}>{tn('profile.passwordUpdated')}</div>
            <button className="btn-primary" style={{ marginTop: 14 }} onClick={onClose}>
              {tn('common.done')}
            </button>
          </>
        ) : (
          <>
            <div className="auth-field" style={{ marginTop: 12 }}>
              <label htmlFor="change-password-new">{tn('profile.newPassword')}</label>
              <input
                id="change-password-new"
                type="password"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={tn('profile.passwordMin')}
              />
            </div>
            <div className="auth-field">
              <label htmlFor="change-password-confirm">{tn('profile.repeatPassword')}</label>
              <input
                id="change-password-confirm"
                type="password"
                minLength={6}
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder={tn('profile.passwordAgain')}
              />
              {mismatch && <div style={{ fontSize: 12.5, color: '#D33', marginTop: 4 }}>{tn('profile.passwordMismatch')}</div>}
            </div>
            {error && (
              <div style={{ color: '#D33', fontSize: 12.5, fontWeight: 600, marginTop: 4 }}>{error}</div>
            )}
            <button className="btn-primary" style={{ marginTop: 10 }} disabled={!valid || pending} onClick={handleSubmit}>
              {pending ? tn('common.saving') : tn('profile.savePassword')}
            </button>
            <button className="btn-secondary" style={{ marginTop: 8 }} disabled={pending} onClick={onClose}>
              {tn('common.cancel')}
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

  const initials = (profile?.displayName ?? tn('common.angler')).slice(0, 2).toUpperCase()

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-card-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-close tap-scale" onClick={onClose}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.4" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </div>
        <div className="modal-title" style={{ textAlign: 'center' }}>
          {tn('profile.editProfile')}
        </div>

        <div className="avatar-edit-wrap" style={{ marginTop: 18 }}>
          <div className="profile-avatar">
            {avatarStatus === 'uploading' ? (
              <HexLoader size={0.42} />
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
            {tn('profile.photoFailed')}
          </div>
        )}

        <div className="auth-field" style={{ marginTop: 8 }}>
          <label htmlFor="edit-name">{tn('profile.name')}</label>
          <input id="edit-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} />
        </div>

        <div className="auth-field">
          <label htmlFor="edit-bio">{tn('profile.about')}</label>
          <textarea
            id="edit-bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={280}
            rows={3}
            placeholder={tn('profile.optional')}
            style={{ resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>

        <div className="auth-field">
          <label>Email</label>
          <input value={user?.email ?? ''} disabled />
          <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 4 }}>{tn('profile.emailLocked')}</div>
        </div>

        <button className="btn-primary" style={{ marginTop: 6 }} onClick={handleSave} disabled={!displayName.trim() || updateProfile.isPending}>
          {updateProfile.isPending ? tn('common.saving') : tn('common.save')}
        </button>
        <button className="btn-secondary" style={{ marginTop: 8 }} onClick={() => setChangingPassword(true)}>
          {tn('profile.changePassword')}
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
          {tn('profile.territoryColor')}
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
          {updateProfile.isPending ? tn('common.saving') : tn('common.save')}
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
  onOpenAdminStats,
  onOpenAdminLimits,
  onOpenFaq,
  onOpenAdminLog,
  adminLogUnreadCount,
  onOpenAchievements,
  onOpenAchievementDetail,
  onOpenAward,
  onShareProfile,
  onInviteFriends,
  onOpenFollowers,
  onOpenSpecies,
  onPostAnnouncement,
  onEditPublicId,
  onGrantCoins,
  onGrantSpins,
  maintenanceOn,
  onOpenMaintenance,
  onOpenShop,
  onOpenChallenges,
  onOpenClans,
  onOpenClan,
  onOpenGeo,
  onOpenAdminGeo,
  active,
  adminPanelActive,
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
  // feedIds: swipe through only these catches (the «Трофеи» podium).
  onOpenPhoto: (catchId: number, feedIds?: number[]) => void
  onOpenReports: () => void
  onOpenAdminAccess: () => void
  onOpenAdminStats: () => void
  onOpenAdminLimits: () => void
  onOpenFaq: () => void
  onOpenAdminLog: () => void
  adminLogUnreadCount: number
  onOpenAchievements: () => void
  onOpenAchievementDetail: (icon: Achievement['icon']) => void
  onOpenAward: (group: AwardGroup) => void
  onShareProfile: (publicId: string, text: string) => void
  // «Пригласи друзей» — the plain referral link (+100 coins each side).
  onInviteFriends: () => void
  onOpenFollowers: (people: ProfileSummary[]) => void
  onOpenSpecies: (species: SpeciesEntry[]) => void
  onPostAnnouncement: () => void
  onEditPublicId: (id: string) => void
  onGrantCoins: (id: string) => void
  onGrantSpins: (id: string) => void
  // «Технические работы» (super admin): whether the maintenance screen is on, and its switch.
  maintenanceOn: boolean
  onOpenMaintenance: () => void
  onOpenShop: () => void
  onOpenChallenges: () => void
  onOpenClans: () => void
  onOpenClan: (id: number) => void
  onOpenGeo: () => void
  onOpenAdminGeo: () => void
  // The profile tab is the one on screen: its numbers count up each time it comes into view.
  active: boolean
  // The profile is on screen and no admin window is over it (AdminPanel reopens its sheet then).
  adminPanelActive: boolean
}) {
  const { user } = useAuth()
  const { data: profile } = useProfile(user?.id ?? null)
  // «Клановая экономика» (super admin): the clan update's switch and its pilot clans.
  const [economyOpen, setEconomyOpen] = useState(false)
  const { data: geo, isPending: geoPending } = useGeoToday()
  const { data: clanChat } = useClanChatSummary(profile?.clanId ?? null)
  const shopRewards = useShopRewardsCount()
  const { data: myCatches = [], isPending: myCatchesPending } = useMyCatches()
  const canModerateReports = useCanModerateReports()
  const canReviewPanoramas = useCanReviewPanoramas()
  const canViewStats = useCanViewStats()
  const canViewLimits = useCanViewLimits()
  const isSuperAdmin = useIsSuperAdmin()
  // «Где это?» only while the city has a panorama of the day — not for a city without the
  // game yet (the new ones), super admin included: they fill the game from the panorama
  // review, not from this card. Nor a game played earlier today in the city moved from: the
  // server keeps it the day's until midnight, but it is not this city's.
  const showGeoCard = !!geo?.panorama && geo.city === city
  const { data: reports = [] } = useReports()
  const { data: claimedFromOthers = false } = useHasClaimedFromOthers(user?.id ?? null)
  const { data: earnedAchievements } = useEarnedAchievements(user?.id ?? null)
  const { data: awards = [], isSuccess: awardsLoaded } = useUserAwards(user?.id ?? null)
  const { data: followers = [] } = useFollowers(user?.id ?? null)
  const equippedFrame = resolveAvatarFrame(profile?.equippedFrame)

  // `!user` never reaches this screen anymore — FishZoneApp's onboarding gate
  // intercepts before ProfileScreen (or any other screen) can mount. See
  // DECISIONS.md.
  const t = useT()
  const mySpecies = speciesBreakdown(myCatches)
  const speciesCount = mySpecies.length
  const topCatches = trophies(myCatches)
  const achievements = computeAchievements(
    myCatches,
    {
      myTerritories: heldTerritories(allTerritories, user?.id),
      allTerritories,
      followersCount: profile?.followersCount ?? 0,
      claimedFromOthers,
      earned: earnedAchievements,
    },
    city
  )
  const recentMine = myCatches.slice(0, 3)
  const visibleTerritories = myTerritories.slice(0, 5)
  const initials = (profile?.displayName ?? tn('common.angler')).slice(0, 2).toUpperCase()
  // Synthetic placeholder set by the Telegram auto-sign-in handshake (see
  // api/auth/telegram/route.ts) — never a real address the person chose, so
  // offering "Link email" only makes sense while it's still this pattern.
  const isTelegramAccount = user?.email?.endsWith('@telegram.catchrange.com') ?? false
  const [installOpen, setInstallOpen] = useState(false)
  const showAddToHomeScreen = useCanInstall()

  function handleShareProfile() {
    if (!profile?.publicId) return
    const text = tn('profile.shareProfile', {
      territories: `${myTerritories.length} ${pluralTerritories(myTerritories.length)}`,
      catches: `${myCatches.length} ${pluralCatches(myCatches.length)}`,
    })
    onShareProfile(profile.publicId, text)
  }

  return (
    <div className="screen-inner">
      <div
        className="profile-hero"
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
            <LiveCoinBalance value={profile?.coins ?? 0} />
          </button>
          <div className="icon-btn tap-scale" onClick={handleShareProfile}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 15V4M12 4 8 8M12 4l4 4" />
              <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
            </svg>
          </div>
        </div>
        <AwardsRing awards={awards} showLocked={awardsLoaded} onOpenAward={onOpenAward}>
          <div className="profile-hero-avatar-ring">
            {equippedFrame && (
              <AvatarFrameRing frame={equippedFrame} />
            )}
            <div className="avatar-edit-wrap">
              <div className="profile-avatar">
                {profile?.avatarUrl ? (
                  <img src={thumbUrl(profile.avatarUrl, 240)} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
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
          <StyledName name={profile?.displayName ?? tn('profile.profileFallback')} styleId={profile?.equippedNameStyle} />
        </div>
        <div className="profile-hero-meta">
          {profile?.createdAt && <>{tn('profile.joinedPre')}<b>{formatJoinedDate(profile.createdAt)}</b>{tn('profile.joinedPost')}</>}
          {profile?.publicId && <> · ID {profile.publicId}</>}
        </div>
        <div className="profile-hero-badge">
          <button
            className="section-link"
            style={{ color: 'rgba(var(--hero-text-rgb,255,255,255),.75)', display: 'inline-flex', alignItems: 'center', gap: 5 }}
            onClick={onOpenCityPicker}
          >
            <Flag country={CITIES[city].country} height={13} />
            {tn('profile.city', { city: CITIES[city].name })}
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
          <b><CountUp value={myTerritories.length} play={active} /></b>
          <span>{pluralTerritories(myTerritories.length)}</span>
        </button>
        <button data-tour="diary" className="hero-stat" onClick={onOpenAllCatches}>
          <b>{myCatchesPending ? <span className="skel hero-stat-skel" /> : <CountUp value={myCatches.length} play={active} />}</b>
          <span>{pluralCatches(myCatches.length)}</span>
        </button>
        <button data-tour="species-stats" className="hero-stat" onClick={() => onOpenSpecies(mySpecies)}>
          <b><CountUp value={speciesCount} play={active} /></b>
          <span>{tn('profile.speciesOfFish', { count: speciesCount })}</span>
        </button>
        <button
          className="hero-stat"
          onClick={() => (profile?.followersCount ?? 0) > 0 && onOpenFollowers(followers)}
        >
          <b><CountUp value={profile?.followersCount ?? 0} play={active} /></b>
          <span>{pluralFollowers(profile?.followersCount ?? 0)}</span>
        </button>
      </div>

      <div className="profile-cta-row">
        <button data-tour="challenges" className="profile-cta-btn profile-cta-challenges tap-scale" onClick={onOpenChallenges}>
          <div className="profile-cta-pattern" />
          <span className="profile-cta-arrow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </span>
          <span className="profile-cta-icon">{CTA_ICONS.target}</span>
          <span className="profile-cta-title">{tn('profile.challengesTitle')}</span>
          <span className="profile-cta-sub">{tn('profile.challengesSub')}</span>
        </button>
        <button data-tour="shop" className="profile-cta-btn profile-cta-shop tap-scale" onClick={onOpenShop}>
          <div className="profile-cta-pattern" />
          <span className="profile-cta-arrow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </span>
          <span className="profile-cta-icon">
            {CTA_ICONS.bag}
            {/* Slot spins waiting there (lib/shopRewards.ts). */}
            {shopRewards.total > 0 && <span className="profile-cta-badge">{shopRewards.total > 9 ? '9+' : shopRewards.total}</span>}
          </span>
          <span className="profile-cta-title">{tn('profile.shopTitle')}</span>
          <span className="profile-cta-sub">{tn('profile.shopSub')}</span>
        </button>
      </div>

      {/* The clan and «Где это?» side by side, half each, like «Челленджи» and
          «Магазин» above — the clan alone takes the whole row. */}
      <div className={`profile-duo${showGeoCard || geoPending ? '' : ' single'}`}>
      {profile?.clanId ? (
        <button
          data-tour="clan" className="profile-clan-card tap-scale"
          style={{ background: resolveClanBackground(null).css }}
          onClick={() => onOpenClan(profile.clanId!)}
        >
          <ClanCrest crest={profile.clanCrest} size={52} />
          <span className="profile-clan-text">
            <span className="profile-clan-kicker">{profile.clanRole ? CLAN_ROLE_LABEL[profile.clanRole] : tn('map.clan')}</span>
            <span className="profile-clan-name">{profile.clanName}</span>
          </span>
          {(clanChat?.unread ?? 0) > 0 && (
            <span className="profile-clan-unread" aria-label={tn('profile.unreadChat', { count: clanChat!.unread })}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12Z" />
              </svg>
              {clanChat!.unread > 99 ? '99+' : clanChat!.unread}
            </span>
          )}
          <span className="profile-cta-arrow" style={{ position: 'static' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </button>
      ) : (
        <button data-tour="clan" className="profile-clan-card profile-clan-card-empty tap-scale" onClick={onOpenClans}>
          <span className="profile-clan-stack" aria-hidden>
            <ClanCrest crest={{ shape: 'shield', symbol: 'anchor', primary: '#1D6FC9', secondary: '#FFFFFF' }} size={34} />
            <ClanCrest crest={{ shape: 'hex', symbol: 'pike', primary: '#FC5200', secondary: '#FFE7C2' }} size={42} />
            <ClanCrest crest={{ shape: 'round', symbol: 'flame', primary: '#1F8A5B', secondary: '#FFFFFF' }} size={34} />
          </span>
          <span className="profile-clan-text">
            <span className="profile-clan-kicker">{tn('map.clans')}</span>
            <span className="profile-clan-name">{tn('profile.joinOrCreate')}</span>
          </span>
          <span className="profile-cta-arrow" style={{ position: 'static' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </button>
      )}

      {/* «Где это?» — shown once the city has a panorama of the day (or to a
          super admin, who fills the game). */}
      {geoPending && !showGeoCard && <span className="skel profile-geo-skel" aria-hidden />}
      {showGeoCard && (
        <button
          data-tour="geo"
          className="profile-geo-card tap-scale"
          // The day's panorama itself behind the card (its small copy, where
          // the view opens), darkened towards the words.
          style={geo?.panorama ? ({ '--geo-bg': `url(${geoImageUrl(geo.panorama.image, 'small')})`, '--geo-x': `${50 + (geo.panorama.heading / 360) * 100}%` } as React.CSSProperties) : undefined}
          onClick={onOpenGeo}
        >
          <span className="profile-geo-art" aria-hidden>
            <GeoHex />
            <span className="profile-geo-q">?</span>
          </span>
          <span className="profile-clan-text">
            <span className="profile-clan-kicker">{tn('profile.dailyGame')}</span>
            <span className="profile-clan-name">{tn('shell.geoTitle')}</span>
          </span>
          {geo?.panorama && !geo.result && <span className="profile-geo-dot" aria-label={tn('profile.panoramaWaiting')} />}
          <span className="profile-cta-arrow" style={{ position: 'static' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </button>
      )}
      </div>

      <div className="section-title-row" style={{ marginTop: 24 }}>
        <div className="section-title">
          {tn('profile.achievements')}
          <span className="ach-count" aria-label={tn('ach.summary', { done: achievements.filter((x) => x.unlocked).length, total: achievements.length })}>
            <b>{achievements.filter((x) => x.unlocked).length}</b>/{achievements.length}
          </span>
        </div>
        <button className="section-link" onClick={onOpenAchievements}>
          {tn('profile.allAchievements')}
        </button>
      </div>
      <div className="ach-grid">
        {achievements.slice(0, 4).map((a, i) => (
          <AchievementCard key={a.icon} a={a} index={i} onOpen={() => onOpenAchievementDetail(a.icon)} />
        ))}
      </div>

      <div className="section-title-row" style={{ marginTop: 24 }}>
        <div className="section-title">{tn('profile.recentCatches')}</div>
        {myCatches.length > recentMine.length && (
          <button className="section-link" onClick={onOpenAllCatches}>
            {tn('profile.allCatches')}
          </button>
        )}
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        {recentMine.length ? (
          recentMine.map((c, i) => <ProfileCatchRow key={c.id} c={c} last={i === recentMine.length - 1} onOpenPhoto={onOpenPhoto} />)
        ) : (
          myCatchesPending ? (
            <SkeletonRows count={3} />
          ) : (
            <div style={{ padding: '22px 14px', textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5 }}>{tn('map.noCatches')}</div>
          )
        )}
      </div>

      <div className="section-title-row" style={{ marginTop: 24 }}>
        <div className="section-title">{tn('profile.myTerritories')}</div>
        {myTerritories.length > visibleTerritories.length && (
          <button className="section-link" onClick={onOpenAllTerritories}>
            {tn('profile.allMyTerritories')}
          </button>
        )}
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        {visibleTerritories.length ? (
          visibleTerritories.map((t, i) => (
            <ProfileSectorRow key={t.id} t={t} last={i === visibleTerritories.length - 1} onOpen={onOpenTerritory} legendUserId={user?.id} />
          ))
        ) : (
          <div style={{ padding: '22px 14px', textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5 }}>{tn('profile.noTerritories')}</div>
        )}
      </div>

      <ProfileTrophies catches={topCatches} onOpenPhoto={onOpenPhoto} />

      {/* Every admin tool behind one «Управление» card (AdminPanel). The
          super admin sees all of them; an admin, the ones given to them. */}
      {economyOpen && <EconomyAdminLazy onClose={() => setEconomyOpen(false)} />}
      <AdminPanel
        active={adminPanelActive}
          items={[
            ...(canModerateReports ? [{ id: 'reports', label: 'Жалобы на фото', icon: ADMIN_ICONS.reports, tone: 'mod' as const, badge: reports.length, onClick: onOpenReports }] : []),
            ...(canReviewPanoramas || isSuperAdmin ? [{ id: 'geo', label: 'Панорамы «Где это?»', icon: ADMIN_ICONS.panoramas, tone: 'mod' as const, onClick: onOpenAdminGeo }] : []),
            ...(canViewStats || isSuperAdmin ? [{ id: 'stats', label: 'Статистика', icon: ADMIN_ICONS.stats, tone: 'data' as const, onClick: onOpenAdminStats }] : []),
            ...(canViewLimits || isSuperAdmin ? [{ id: 'limits', label: 'Лимиты сервисов', icon: ADMIN_ICONS.limits, tone: 'data' as const, onClick: onOpenAdminLimits }] : []),
            ...(isSuperAdmin
              ? [
                  { id: 'log', label: 'Последние действия', icon: ADMIN_ICONS.log, tone: 'data' as const, badge: adminLogUnreadCount, onClick: onOpenAdminLog },
                  { id: 'access', label: 'Доступы', icon: ADMIN_ICONS.access, tone: 'manage' as const, onClick: onOpenAdminAccess },
                  { id: 'post', label: 'Написать пост', icon: ADMIN_ICONS.post, tone: 'manage' as const, onClick: onPostAnnouncement },
                  { id: 'economy', label: 'Клановая экономика', icon: ADMIN_ICONS.coins, tone: 'manage' as const, onClick: () => setEconomyOpen(true) },
                  { id: 'maintenance', label: maintenanceOn ? 'Техработы: включены' : 'Технические работы', icon: ADMIN_ICONS.maintenance, tone: 'manage' as const, badge: maintenanceOn ? 1 : 0, onClick: onOpenMaintenance },
                ]
              : []),
            ...(isSuperAdmin && user
              ? [
                  { id: 'id', label: 'Изменить ID', icon: ADMIN_ICONS.publicId, tone: 'manage' as const, onClick: () => onEditPublicId(user.id) },
                  { id: 'coins', label: `Монеты ${profile?.coins ?? 0}`, icon: ADMIN_ICONS.coins, tone: 'manage' as const, onClick: () => onGrantCoins(user.id) },
                  { id: 'spins', label: 'Прокруты слотов', icon: ADMIN_ICONS.spins, tone: 'manage' as const, onClick: () => onGrantSpins(user.id) },
                ]
              : []),
          ]}
        />

      <button className="profile-invite-card tap-scale" style={{ marginTop: 24 }} onClick={onInviteFriends}>
        <span className="profile-invite-coins" aria-hidden>
          <CoinIcon size={28} />
          <CoinIcon size={20} />
        </span>
        <span className="profile-clan-text">
          <span className="profile-invite-title">{tn('profile.inviteTitle')}</span>
          <span className="profile-invite-sub">{tn('profile.inviteSub')}</span>
        </span>
        <span className="profile-cta-arrow" style={{ position: 'static' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </button>

      <button data-tour="faq" className="profile-faq-row tap-scale" onClick={onOpenFaq}>
        <span className="profile-faq-icon" aria-hidden>
          ?
        </span>
        <span className="profile-faq-text">
          <b>{t('faq.entryTitle')}</b>
          <span>{t('faq.entrySub')}</span>
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <div style={{ marginTop: 12 }}>
        <TelegramNotificationsRow />
      </div>

      {(TRANSLATION_READY || isSuperAdmin) && <LanguagePicker />}

      {isTelegramAccount && (
        <div style={{ marginTop: 12 }}>
          <button className="btn-secondary" onClick={onLinkEmail}>
            {tn('profile.linkEmail')}
          </button>
        </div>
      )}

      {showAddToHomeScreen && (
        <div style={{ marginTop: isTelegramAccount || canModerateReports || canReviewPanoramas || canViewStats || canViewLimits || isSuperAdmin ? 12 : 24 }}>
          <button className="btn-secondary" onClick={() => setInstallOpen(true)}>
            {tn('profile.addHome')}
          </button>
          {installOpen && <InstallAppModal onClose={() => setInstallOpen(false)} />}
        </div>
      )}

      <div style={{ marginTop: showAddToHomeScreen || isTelegramAccount || canModerateReports || canReviewPanoramas || canViewStats || canViewLimits || isSuperAdmin ? 12 : 24, paddingBottom: 24 }}>
        <button className="btn-secondary" onClick={onSignOut}>
          {tn('common.signOut')}
        </button>
      </div>
      </div>
    </div>
  )
}

// «Где это?»'s mark: a sector as the map draws it — a regular flat-top
// hexagon — in the brand's orange, with a question mark (the card's own text).
function GeoHex() {
  return (
    <svg className="profile-geo-hex" viewBox="0 0 56 48.5" aria-hidden>
      <defs>
        <linearGradient id="profile-geo-hex-fill" x1="0" y1="0" x2=".35" y2="1">
          <stop offset="0" stopColor="#FFA24D" />
          <stop offset=".55" stopColor="#FC5200" />
          <stop offset="1" stopColor="#D94400" />
        </linearGradient>
        <radialGradient id="profile-geo-hex-gloss" cx=".32" cy=".12" r=".6">
          <stop offset="0" stopColor="#fff" stopOpacity=".5" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <polygon points="2,24.25 15,1.73 41,1.73 54,24.25 41,46.77 15,46.77" fill="url(#profile-geo-hex-fill)" stroke="#fff" strokeWidth="2.5" strokeLinejoin="round" />
      <polygon points="2,24.25 15,1.73 41,1.73 54,24.25 41,46.77 15,46.77" fill="url(#profile-geo-hex-gloss)" />
    </svg>
  )
}
