'use client'

import { useRef, type CSSProperties } from 'react'
import { thumbUrl } from '@/lib/supabase/imageUrl'
import {
  useProfile,
  useCatchesByUser,
  useIsFollowing,
  useSetFollowing,
  useIsAdmin,
  useIsSuperAdmin,
  useCanBlockUsers,
  useSetBlocked,
  useHasClaimedFromOthers,
  useReportDeletionCount,
  useUserAwards,
  useFollowers,
} from '@/lib/supabase/queries'
import { CoinIcon } from '@/components/app-shell/CoinIcon'
import { AwardsRing } from '@/components/app-shell/AwardsRing'
import { computeAchievements, personalRecord, type Achievement } from '@/lib/data/achievements'
import { KIND_LABEL } from '@/lib/data/species'
import { formatCatchMeta, formatJoinedDate, pluralCatches, pluralFollowers, pluralSpecies, pluralTerritories, speciesBreakdown, type SpeciesEntry } from '@/lib/format'
import { ACH_ICONS } from '@/components/app-shell/icons'
import type { Territory, UserAward, ProfileSummary } from '@/lib/data/types'
import { CITIES } from '@/lib/data/city'
import { resolveHeroBackground } from '@/lib/data/heroBackgrounds'
import { resolveAvatarFrame } from '@/lib/data/shopItems'
import { StyledName } from '@/components/app-shell/StyledName'
import { HeroBgLive } from '@/components/app-shell/HeroBgLive'
import { BackButton } from '@/components/app-shell/BackButton'
import { useMagneticProfileHero } from '@/lib/useMagneticProfileHero'

// Rendered by FishZoneApp itself, not nested inside a screen's scrolling
// `.screen-inner` — same clipping reasoning as every other app-shell-level
// modal (see DECISIONS.md). Just the photo, tap outside (or the photo itself)
// to dismiss — a peek, not a screen, so it skips the stack/back-button
// machinery CatchPhotoScreen needs for a real destination.
export function AvatarPreviewModal({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div style={{ width: '100%', maxWidth: 340 }} onClick={onClose}>
        <img
          src={url}
          alt=""
          style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: 28, display: 'block', boxShadow: '0 24px 48px rgba(0,0,0,.35)' }}
        />
      </div>
    </div>
  )
}

// Read-only counterpart to ProfileScreen — someone else's territories/catches/
// achievements, plus a follow button instead of edit/sign-out controls. See
// DECISIONS.md: territories/catches for this user come from data FishZoneApp
// already has loaded (filtered by ownerId/userId), not new fetches, except the
// user's own catches (useCatchesByUser) which aren't in any existing list.
export function UserProfileScreen({
  userId,
  territories,
  allTerritories,
  onBack,
  onOpenTerritory,
  onOpenPhoto,
  onOpenAchievements,
  onOpenAchievementDetail,
  onOpenAllCatches,
  onDeleteUser,
  onOpenAward,
  onEditAdminAccess,
  onEditPublicId,
  onGrantCoins,
  onShareProfile,
  onOpenFollowers,
  onOpenAvatarPreview,
  onOpenSpecies,
}: {
  userId: string
  territories: Territory[]
  allTerritories: Territory[]
  onBack: () => void
  onOpenTerritory: (id: string) => void
  onOpenPhoto: (catchId: number) => void
  onOpenAchievements: () => void
  onOpenAchievementDetail: (icon: Achievement['icon']) => void
  onOpenAllCatches: () => void
  onDeleteUser: (id: string) => void
  onOpenAward: (award: UserAward) => void
  onEditAdminAccess: (id: string) => void
  onEditPublicId: (id: string) => void
  onGrantCoins: (id: string) => void
  onShareProfile: (publicId: string, text: string) => void
  onOpenFollowers: (people: ProfileSummary[]) => void
  onOpenAvatarPreview: (url: string) => void
  onOpenSpecies: (species: SpeciesEntry[]) => void
}) {
  const { data: profile } = useProfile(userId)
  const equippedFrame = resolveAvatarFrame(profile?.equippedFrame)
  const { data: catches = [] } = useCatchesByUser(userId)
  const { data: isFollowing, isLoading: followLoading } = useIsFollowing(userId)
  const setFollowing = useSetFollowing()
  const isAdmin = useIsAdmin()
  const isSuperAdmin = useIsSuperAdmin()
  const canBlockUsers = useCanBlockUsers()
  const setBlocked = useSetBlocked()
  const { data: claimedFromOthers = false } = useHasClaimedFromOthers(userId)
  const { data: reportDeletionCount } = useReportDeletionCount(userId)
  const { data: awards = [] } = useUserAwards(userId)
  const { data: followers = [] } = useFollowers(userId)

  const catchSpecies = speciesBreakdown(catches)
  const speciesCount = catchSpecies.length
  const record = personalRecord(catches)
  const viewedCity = profile?.city ?? 'batumi'
  const achievements = computeAchievements(
    catches,
    {
      myTerritories: territories,
      allTerritories,
      followersCount: profile?.followersCount ?? 0,
      claimedFromOthers,
    },
    viewedCity
  )
  const recent = catches.slice(0, 3)
  const initials = (profile?.displayName ?? 'Рыбак').slice(0, 2).toUpperCase()
  const territoriesRef = useRef<HTMLDivElement>(null)
  const heroRef = useMagneticProfileHero()

  function handleShare() {
    if (!profile?.publicId) return
    onShareProfile(profile.publicId, `🎣 Профиль ${profile.displayName ?? 'рыбака'} в RANGE`)
  }

  return (
    <>
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
          <BackButton onClick={onBack} registerNative={false} />
          <div className="icon-btn tap-scale" onClick={handleShare}>
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
            <button
              className="profile-hero-avatar-btn"
              style={{ cursor: profile?.avatarUrl ? 'pointer' : 'default' }}
              onClick={() => profile?.avatarUrl && onOpenAvatarPreview(profile.avatarUrl)}
              aria-label={profile?.avatarUrl ? 'Открыть фото' : undefined}
            >
              <div className="profile-avatar">
                {profile?.avatarUrl ? (
                  <img src={thumbUrl(profile.avatarUrl, 240)} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  initials
                )}
              </div>
            </button>
          </div>
        </AwardsRing>
        <div className="profile-hero-name">
          <StyledName name={profile?.displayName ?? 'Профиль'} styleId={profile?.equippedNameStyle} />
        </div>
        {profile?.isBlocked && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
            <span className="badge" style={{ background: '#FDE2E2', color: '#D33' }}>Заблокирован</span>
          </div>
        )}
        <div className="profile-hero-meta">
          {profile?.createdAt && <>В RANGE с <b>{formatJoinedDate(profile.createdAt)}</b></>}
          {profile?.publicId && <> · ID {profile.publicId}</>}
        </div>
        <div className="profile-hero-badge">
          <span className="section-link" style={{ color: 'rgba(var(--hero-text-rgb,255,255,255),.75)', cursor: 'default' }}>
            Город: {CITIES[viewedCity].name}
          </span>
        </div>
        {profile?.bio && (
          <div style={{ fontSize: 13.5, color: 'rgba(var(--hero-text-rgb,255,255,255),.85)', marginTop: 10, lineHeight: 1.4, textAlign: 'center' }}>{profile.bio}</div>
        )}
      </div>
      <div className="profile-body">
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={isFollowing ? 'btn-secondary' : 'btn-primary'}
            style={{ flex: 1 }}
            disabled={followLoading || setFollowing.isPending}
            onClick={() => setFollowing.mutate({ followeeId: userId, following: !isFollowing })}
          >
            {isFollowing ? 'Отписаться' : 'Подписаться'}
          </button>
          {canBlockUsers && !profile?.isSuperAdmin && (
            <button
              className="btn-secondary"
              style={{ flex: 1, color: profile?.isBlocked ? undefined : '#D33' }}
              disabled={setBlocked.isPending}
              onClick={() => setBlocked.mutate({ userId, blocked: !profile?.isBlocked })}
            >
              {profile?.isBlocked ? 'Разблокировать' : 'Заблокировать'}
            </button>
          )}
        </div>

        {(isAdmin || isSuperAdmin) && reportDeletionCount !== undefined && (
          <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: reportDeletionCount > 0 ? '#D33' : 'var(--ink-faint)' }}>
            Удалённых модератором уловов: {reportDeletionCount}
          </div>
        )}

        {isSuperAdmin && !profile?.isSuperAdmin && (
          <div style={{ marginTop: 8 }}>
            <button className="btn-secondary" onClick={() => onEditAdminAccess(userId)}>
              {profile?.isAdmin ? 'Права администратора' : 'Выдать права админа'}
            </button>
          </div>
        )}

        {isSuperAdmin && !profile?.isAdmin && !profile?.isSuperAdmin && (
          <button
            className="btn-secondary"
            style={{ marginTop: 8, color: '#D33' }}
            onClick={() => onDeleteUser(userId)}
          >
            Удалить пользователя
          </button>
        )}

        {isSuperAdmin && (
          <button className="btn-secondary" style={{ marginTop: 8 }} onClick={() => onEditPublicId(userId)}>
            Изменить ID
          </button>
        )}

        {isSuperAdmin && (
          <button className="btn-secondary shop-price-btn" style={{ marginTop: 8 }} onClick={() => onGrantCoins(userId)}>
            Монеты: <CoinIcon size={16} /> {profile?.coins ?? 0}
          </button>
        )}

        <div className="hero-stat-grid" style={{ marginTop: 20 }}>
          <button className="hero-stat" onClick={() => territoriesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
            <b>{territories.length}</b>
            <span>Территорий</span>
          </button>
          <button className="hero-stat" onClick={onOpenAllCatches}>
            <b>{catches.length}</b>
            <span>Уловов</span>
          </button>
          <button className="hero-stat" onClick={() => onOpenSpecies(catchSpecies)}>
            <b>{speciesCount}</b>
            <span>Видов рыб</span>
          </button>
          <button
            className="hero-stat"
            onClick={() => (profile?.followersCount ?? 0) > 0 && onOpenFollowers(followers)}
          >
            <b>{profile?.followersCount ?? 0}</b>
            <span>Подписчика</span>
          </button>
        </div>

        <div className="section-title-row" style={{ marginTop: 24 }}>
          <div className="section-title">Достижения</div>
          <button className="section-link" onClick={onOpenAchievements}>
            Все достижения
          </button>
        </div>
        <div className="ach-grid">
          {achievements.slice(0, 4).map((a) => (
            <div className={`ach-card${a.unlocked ? '' : ' locked'}`} key={a.icon} onClick={() => onOpenAchievementDetail(a.icon)}>
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
          {catches.length > recent.length && (
            <button className="section-link" onClick={onOpenAllCatches}>
              Все уловы
            </button>
          )}
        </div>
        <div className="card" style={{ overflow: 'hidden' }}>
          {recent.length ? (
            recent.map((c, i) => {
              const meta = formatCatchMeta(c.lengthCm, c.weightKg)
              return (
                <div
                  key={c.id}
                  className="tap-scale"
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: i < recent.length - 1 ? '1px solid var(--line)' : 'none', cursor: 'pointer' }}
                  onClick={() => onOpenPhoto(c.id)}
                >
                  <div className="fish-thumb" style={{ width: 46, height: 46 }}>
                    <img src={thumbUrl(c.photoUrl, 240)} alt={c.speciesName} loading="lazy" decoding="async" />
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

        <div className="section-title" style={{ marginTop: 24 }} ref={territoriesRef}>
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
            <div className="card tap-scale" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }} onClick={() => onOpenPhoto(record.id)}>
              <div className="fish-thumb" style={{ width: 52, height: 52 }}>
                <img src={thumbUrl(record.photoUrl, 720)} alt={record.speciesName} loading="lazy" decoding="async" />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{record.speciesName}</div>
                <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 700, marginTop: 2 }}>{record.lengthCm} см</div>
              </div>
            </div>
          </>
        )}
      </div>
      </div>
    </>
  )
}
